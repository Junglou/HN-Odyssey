import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, Types, FilterQuery } from 'mongoose';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { QueryStaffDto } from './dto/query-staff.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { User, UserDocument } from '../schemas/user.schema';
import { Staff } from './schemas/staff.schema';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { UserStatus } from 'src/common/enums/user-status.enum';
import { Role as RoleEnum } from 'src/common/enums/role.enum';
import {
  Department,
  DEPARTMENT_CODES,
  DEPARTMENT_LABELS,
} from 'src/common/enums/department.enum';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { RoleLevel } from 'src/common/enums/role-level.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { BulkChangeStatusDto, BulkDeleteDto } from './dto/bulk-action.dto';
import {
  RESERVED_ROLE_SLUGS,
  isReservedRoleKey,
} from 'src/common/constants/system-roles.constant';

interface MongoError extends Error {
  code?: number;
  keyPattern?: Record<string, number>;
  keyValue?: Record<string, any>;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Staff.name) private readonly staffModel: Model<Staff>,
    private readonly auditLogsService: AuditLogsService,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  //  KIỂM SOÁT VAI TRÒ ĐẶC QUYỀN
  // Vai trò đặc quyền = slug dành riêng (SUPER_ADMIN, ADMIN) + mọi Role có is_system = true.
  // Chỉ Super Admin mới được GÁN các vai trò này, hoặc SỬA / KHÓA / XÓA tài khoản đang giữ chúng.

  private isSuperAdmin(roles: string[] = []): boolean {
    return roles.includes(RoleEnum.SUPER_ADMIN);
  }

  private async getPrivilegedRoleSlugs(): Promise<string[]> {
    const systemRoles = await this.roleModel
      .find({ is_system: true })
      .select('slug')
      .lean<Array<{ slug: string }>>();
    return Array.from(
      new Set([...RESERVED_ROLE_SLUGS, ...systemRoles.map((r) => r.slug)]),
    );
  }

  private async isPrivilegedAccount(roles: string[] = []): Promise<boolean> {
    if (roles.some((r) => isReservedRoleKey(r))) return true;
    const privilegedSlugs = await this.getPrivilegedRoleSlugs();
    return roles.some((r) => privilegedSlugs.includes(r));
  }

  // Vai trò được gán phải tồn tại, đang hoạt động và không vượt quyền người thao tác
  private async validateAssignableRoles(
    roleSlugs: string[],
    currentUserRoles: string[],
  ): Promise<RoleDocument[]> {
    const uniqueSlugs = Array.from(new Set(roleSlugs));
    if (uniqueSlugs.length === 0) {
      throw new BadRequestException('Phải chọn ít nhất một vai trò.');
    }

    const roles = await this.roleModel
      .find({ slug: { $in: uniqueSlugs }, is_active: true })
      .select('slug level is_system');

    if (roles.length !== uniqueSlugs.length) {
      throw new BadRequestException(
        'Một hoặc nhiều vai trò không hợp lệ hoặc đã bị vô hiệu hóa.',
      );
    }

    if (!this.isSuperAdmin(currentUserRoles)) {
      const privileged = roles.filter(
        (r) => r.is_system || isReservedRoleKey(r.slug),
      );
      if (privileged.length > 0) {
        throw new ForbiddenException(
          `Chỉ Super Admin mới được gán vai trò hệ thống: ${privileged
            .map((r) => r.slug)
            .join(', ')}.`,
        );
      }
    }

    return roles;
  }

  private hasSameRoles(current: string[] = [], next: string[] = []): boolean {
    const a = new Set(current);
    const b = new Set(next);
    return a.size === b.size && [...a].every((r) => b.has(r));
  }

  //  KIỂM SOÁT CẤP BẬC (RoleLevel)
  // Số càng nhỏ càng cao: BOARD = 1 > MANAGEMENT = 2 > STAFF = 3

  private async getHighestLevel(roleSlugs: string[] = []): Promise<number> {
    if (roleSlugs.length === 0) return RoleLevel.STAFF;
    const roles = await this.roleModel
      .find({ slug: { $in: roleSlugs } })
      .select('level')
      .lean<Array<{ level?: number }>>();
    if (roles.length === 0) return RoleLevel.STAFF;
    return Math.min(...roles.map((r) => r.level ?? RoleLevel.STAFF));
  }

  // Chỉ được đổi trạng thái nhân sự có cấp THẤP HƠN mình (Super Admin bỏ qua)
  private async assertLowerLevelTargets(
    targetIds: string[],
    currentUserRoles: string[],
  ): Promise<void> {
    if (this.isSuperAdmin(currentUserRoles)) return;

    const actorLevel = await this.getHighestLevel(currentUserRoles);
    const targets = await this.userModel
      .find({ _id: { $in: targetIds } })
      .select('roles')
      .lean<Array<{ roles?: string[] }>>();

    const allSlugs = Array.from(new Set(targets.flatMap((t) => t.roles ?? [])));
    const roleDocs = await this.roleModel
      .find({ slug: { $in: allSlugs } })
      .select('slug level')
      .lean<Array<{ slug: string; level?: number }>>();
    const levelOf = new Map(
      roleDocs.map((r) => [r.slug, r.level ?? RoleLevel.STAFF]),
    );

    const hasBlockedTarget = targets.some((t) => {
      const levels = (t.roles ?? []).map(
        (s) => levelOf.get(s) ?? RoleLevel.STAFF,
      );
      const targetLevel = levels.length ? Math.min(...levels) : RoleLevel.STAFF;
      return targetLevel <= actorLevel;
    });

    if (hasBlockedTarget) {
      throw new ForbiddenException(
        'Bạn chỉ được thay đổi trạng thái của nhân sự có cấp bậc thấp hơn mình.',
      );
    }
  }

  //  HELPER CŨ

  private removeVietnameseTones(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  private getInitials(lastName: string, firstName: string): string {
    const fullName = `${firstName} ${lastName} `;
    let cleanName = this.removeVietnameseTones(fullName);
    cleanName = cleanName.replace(/[^a-zA-Z0-9\s]/g, '');
    return cleanName
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase())
      .join('');
  }

  private async generateEmployeeCode(
    lastName: string,
    firstName: string,
    department: string,
    roles: string[],
  ) {
    const initials = this.getInitials(lastName, firstName);
    const deptCode = this.getDepartmentCode(department);

    const validRoles = await this.roleModel
      .find({
        slug: { $in: roles },
        is_active: true,
      })
      .select('level');

    const roleLevels = validRoles.map((r) => r.level || RoleLevel.STAFF);
    const minLevel = Math.min(...roleLevels);

    const codePrefix = `${initials}-${deptCode}-${minLevel}`;
    const regex = new RegExp(`^${codePrefix}-\\d{4}$`);

    const lastStaff = await this.staffModel
      .findOne({ employee_code: { $regex: regex } })
      .sort({ employee_code: -1 })
      .select('employee_code');

    let nextSequence = 1;
    if (lastStaff && lastStaff.employee_code) {
      const parts = lastStaff.employee_code.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) nextSequence = lastSeq + 1;
    }

    return `${codePrefix}-${nextSequence.toString().padStart(4, '0')}`;
  }

  private getDepartmentCode(department: string): string {
    return DEPARTMENT_CODES[department as Department] || '0';
  }

  getDepartmentOptions = () => {
    return Object.values(Department).map((dept) => ({
      value: dept,
      label: DEPARTMENT_LABELS[dept],
      code: DEPARTMENT_CODES[dept],
    }));
  };

  // HELPER: Type-safe diff
  private getDiff(
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
  ): Record<string, any> {
    const diff: Record<string, any> = {};
    Object.keys(newData).forEach((key) => {
      if (['password', 'confirm_password'].includes(key)) return;

      const oldVal = oldData[key];
      const newVal = newData[key];

      if (
        newVal !== undefined &&
        JSON.stringify(oldVal) !== JSON.stringify(newVal)
      ) {
        diff[key] = { old: oldVal, new: newVal };
      }
    });
    return diff;
  }

  // 1. TẠO MỚI STAFF
  async createStaff(
    dto: CreateStaffDto,
    createdById: string,
    ip: string,
    userAgent: string,
    currentUserRoles: string[],
  ) {
    // Vai trò phải tồn tại, đang hoạt động; vai trò hệ thống chỉ Super Admin được gán
    const validRoles = await this.validateAssignableRoles(
      dto.roles,
      currentUserRoles,
    );
    const roleSlugs = Array.from(new Set(dto.roles));

    const existUser = await this.userModel.findOne({ email: dto.email });
    if (existUser) throw new ConflictException('Email đã tồn tại.');

    const initials = this.getInitials(dto.lastName, dto.firstName);
    const deptCode = this.getDepartmentCode(dto.department);
    const roleLevels = validRoles.map((r) => r.level || RoleLevel.STAFF);
    const minLevel = Math.min(...roleLevels);
    const codePrefix = `${initials}-${deptCode}-${minLevel}`;
    const regex = new RegExp(`^${codePrefix}-\\d{4}$`);

    const lastStaff = await this.staffModel
      .findOne({ employee_code: { $regex: regex } })
      .sort({ employee_code: -1 })
      .select('employee_code');

    let nextSequence = 1;
    if (lastStaff && lastStaff.employee_code) {
      const parts = lastStaff.employee_code.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) nextSequence = lastSeq + 1;
    }

    const finalEmployeeCode = `${codePrefix}-${nextSequence.toString().padStart(4, '0')}`;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const generatedUsername = `${dto.email.split('@')[0]}_${Date.now().toString().slice(-4)}`;

    const newStaff = new this.staffModel({
      employee_code: finalEmployeeCode,
      username: generatedUsername,
      email: dto.email,
      phone: dto.phone,
      first_Name: dto.firstName,
      last_Name: dto.lastName,
      password: hashedPassword,
      roles: roleSlugs,
      type: 'Staff',
      department: dto.department,
      status: UserStatus.ACTIVE,
      metadata: { createdBy: createdById },
    });

    let savedUser;
    try {
      savedUser = await newStaff.save();
    } catch (error: unknown) {
      const mongoError = error as MongoError;
      if (mongoError.code === 11000 && mongoError.keyPattern) {
        if (mongoError.keyPattern.employee_code) {
          throw new ConflictException(
            `Hệ thống bận (Trùng mã ${finalEmployeeCode}). Vui lòng thử lại.`,
          );
        }
        if (mongoError.keyPattern.email)
          throw new ConflictException(`Email '${dto.email}' đã tồn tại.`);
        if (mongoError.keyPattern.phone)
          throw new ConflictException(`SĐT '${dto.phone}' đã tồn tại.`);
      }
      throw new InternalServerErrorException(error);
    }

    const staffData = savedUser as unknown as Staff & { _id: Types.ObjectId };

    await this.auditLogsService.log({
      action: 'CREATE_STAFF',
      collection_name: 'users',
      actor_id: createdById,
      target_id: staffData._id,
      actor_employee_code: staffData.employee_code,
      department: Department.MANAGEMENT,
      detail: {
        email: staffData.email,
        roles: staffData.roles,
        employee_code: staffData.employee_code,
        department: staffData.department,
      },
      ip,
      user_agent: userAgent,
    });

    return {
      message: 'Tạo tài khoản Staff thành công.',
      data: {
        _id: staffData._id,
        email: staffData.email,
        employeeCode: staffData.employee_code,
      },
    };
  }

  // 2. CẬP NHẬT STAFF
  async updateStaff(
    id: string,
    dto: UpdateStaffDto,
    currentUserId: string,
    currentUserRoles: RoleEnum[],
    ip: string,
    userAgent: string,
  ) {
    const user = await this.staffModel.findById(id);
    if (!user) throw new NotFoundException('Nhân sự không tồn tại.');

    const actorIsSuperAdmin = this.isSuperAdmin(currentUserRoles);
    const isSelf = id === currentUserId.toString();

    // Chỉ Super Admin mới được sửa tài khoản giữ vai trò hệ thống
    // (chặn việc đổi mật khẩu / email của Super Admin để chiếm tài khoản)
    if (
      !actorIsSuperAdmin &&
      !isSelf &&
      (await this.isPrivilegedAccount(user.roles))
    ) {
      throw new ForbiddenException(
        'Chỉ Super Admin mới được chỉnh sửa tài khoản quản trị hệ thống.',
      );
    }

    const rolesChanged =
      !!dto.roles && !this.hasSameRoles(user.roles, dto.roles);

    if (rolesChanged && dto.roles) {
      // Không ai được tự thay đổi vai trò của chính mình (chống tự nâng quyền)
      if (isSelf) {
        throw new ForbiddenException(
          'Không thể tự thay đổi vai trò của chính mình.',
        );
      }
      await this.validateAssignableRoles(dto.roles, currentUserRoles);
    }

    if (isSelf && dto.is_active === false) {
      throw new ForbiddenException('Không thể tự khóa chính mình.');
    }

    const oldData = user.toObject() as unknown as Record<string, unknown>;

    if (rolesChanged && dto.roles) {
      const currentLevelStr = user.employee_code.split('-')[2];
      const validRoles = await this.roleModel
        .find({ slug: { $in: dto.roles }, is_active: true })
        .select('level');

      const roleLevels = validRoles.map((r) => r.level || RoleLevel.STAFF);
      const newMinLevel = Math.min(...roleLevels);

      if (currentLevelStr && newMinLevel.toString() !== currentLevelStr) {
        user.employee_code = await this.generateEmployeeCode(
          user.last_Name,
          user.first_Name,
          user.department,
          dto.roles,
        );
      }
    }

    // Đổi mật khẩu → buộc đăng nhập lại trên mọi thiết bị (JwtStrategy so token_version)
    let revokeSessions = false;
    if (dto.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(dto.password, salt);
      revokeSessions = true;
    }

    // Trạng thái chỉ được đổi qua PATCH :id/status (quyền CHANGE_STATUS).
    // Gửi is_active KHÁC trạng thái hiện tại qua API sửa thông tin → chặn.
    if (
      typeof dto.is_active !== 'undefined' &&
      dto.is_active !== (user.status === UserStatus.ACTIVE)
    ) {
      throw new ForbiddenException(
        'Không thể đổi trạng thái qua chức năng sửa thông tin. Vui lòng dùng nút Bật/Tắt trạng thái.',
      );
    }

    if (dto.email && dto.email !== user.email) {
      const existEmail = await this.userModel.findOne({ email: dto.email });
      if (existEmail) throw new ConflictException('Email đã được sử dụng.');
      user.email = dto.email;
    }

    if (dto.phone) user.phone = dto.phone;
    if (dto.firstName) user.first_Name = dto.firstName;
    if (dto.lastName) user.last_Name = dto.lastName;
    if (dto.department) user.department = dto.department;
    if (rolesChanged && dto.roles) user.roles = Array.from(new Set(dto.roles));

    if (revokeSessions) {
      const currentVersion = Number(user.get('token_version') ?? 0);
      user.set('token_version', currentVersion + 1);
    }

    try {
      await user.save();
    } catch (error: unknown) {
      const mongoError = error as MongoError;
      if (mongoError.code === 11000)
        throw new ConflictException('Dữ liệu (SĐT hoặc Mã) đã tồn tại.');
      throw new InternalServerErrorException(error);
    }

    const diff = this.getDiff(
      oldData,
      dto as unknown as Record<string, unknown>,
    );

    if ((oldData.employee_code as string) !== user.employee_code) {
      diff['employee_code'] = {
        old: oldData.employee_code,
        new: user.employee_code,
      };
    }
    if (dto.password) {
      diff['password'] = { changed: true }; // Ghi vết có đổi mật khẩu, không lưu giá trị
    }

    await this.auditLogsService.log({
      action: 'UPDATE_STAFF_INFO',
      collection_name: 'users',
      actor_id: currentUserId,
      target_id: user._id,
      department: Department.MANAGEMENT,
      detail: { employee_code: user.employee_code, changes: diff },
      ip,
      user_agent: userAgent,
    });

    if (rolesChanged) {
      this.eventEmitter.emit(NOTIFY_EVENTS.SECURITY_ALERT, {
        severity: 'HIGH',
        message: `Hoạt động phân quyền: Tài khoản ${user.email} vừa được thay đổi quyền hạn thành [${user.roles.join(', ')}] bởi Admin ID: ${currentUserId}.`,
        user_id: user._id.toString(),
        ip: ip,
      });
    }

    return { message: 'Cập nhật thành công.', user };
  }

  // 3. XÓA MỀM (Soft Delete)
  async softDeleteStaff(
    id: string,
    currentUserId: string,
    currentUserRoles: string[],
    ip: string,
    userAgent: string,
  ) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Nhân sự không tồn tại.');

    if (
      !this.isSuperAdmin(currentUserRoles) &&
      (await this.isPrivilegedAccount(user.roles))
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền vô hiệu hóa tài khoản quản trị hệ thống.',
      );
    }

    if (id === currentUserId.toString()) {
      throw new ForbiddenException(
        'Bạn không thể tự vô hiệu hóa tài khoản của chính mình.',
      );
    }

    const oldStatus = user.status;
    user.status = UserStatus.TERMINATED;
    user.token_version = (user.token_version || 0) + 1;

    await user.save();

    const employeeCode = (user as unknown as Staff).employee_code || 'UNKNOWN';

    await this.auditLogsService.log({
      action: 'DELETE_STAFF',
      collection_name: 'users',
      actor_id: currentUserId,
      target_id: id,
      department: Department.MANAGEMENT,
      detail: {
        employee_code: employeeCode,
        old_status: oldStatus,
        reason: 'Soft delete request by Admin',
      },
      ip,
      user_agent: userAgent,
    });

    return { message: 'Đã vô hiệu hóa nhân sự thành công.' };
  }

  // 4. DANH SÁCH NHÂN SỰ
  async findAllStaff(query: QueryStaffDto) {
    type ExtendedQuery = QueryStaffDto & {
      status?: string;
      employee_code?: string;
      is_active?: string | boolean;
      role?: string[];
      search?: string;
      sort_by?: string;
      sort_direction?: string;
    };

    const {
      page = 1,
      limit = 20,
      search,
      role,
      status,
      is_active,
      employee_code,
      sort_by = 'createdAt',
      sort_direction = 'desc',
    } = query as ExtendedQuery;

    const skip = (Number(page) - 1) * Number(limit);

    const filter: FilterQuery<UserDocument> & { employee_code?: any } = {
      type: 'Staff',
    };

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [
        {
          $expr: {
            $regexMatch: {
              input: {
                $concat: [
                  { $ifNull: ['$last_Name', ''] },
                  ' ',
                  { $ifNull: ['$first_Name', ''] },
                ],
              },
              regex: search,
              options: 'i',
            },
          },
        },
        {
          $expr: {
            $regexMatch: {
              input: {
                $concat: [
                  { $ifNull: ['$first_Name', ''] },
                  ' ',
                  { $ifNull: ['$last_Name', ''] },
                ],
              },
              regex: search,
              options: 'i',
            },
          },
        },
        { email: searchRegex },
      ];
    }

    if (employee_code) {
      filter.employee_code = { $regex: employee_code, $options: 'i' };
    }

    if (role) {
      filter.roles = role;
    }

    if (status) {
      filter.status = status;
    } else if (is_active !== undefined && is_active !== null) {
      const isActiveBool = String(is_active) === 'true';
      if (isActiveBool) {
        filter.status = UserStatus.ACTIVE;
      } else {
        // Chỉ lấy những tài khoản bị KHÓA, tuyệt đối KHÔNG lấy tài khoản đã XÓA
        filter.status = UserStatus.SUSPENDED;
      }
    } else {
      // Mặc định luôn ẩn các tài khoản đã bị xóa (Terminated)
      filter.status = { $ne: UserStatus.TERMINATED };
    }

    const [total, users] = await Promise.all([
      this.userModel.countDocuments(filter),
      this.userModel
        .find(filter)
        .select('-password -__v -token_version')
        .sort({ [sort_by]: sort_direction === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
    ]);

    return {
      data: users,
      meta: {
        total_docs: total,
        current_page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(total / Number(limit)),
        has_next_page: Number(page) < Math.ceil(total / Number(limit)),
        has_prev_page: Number(page) > 1,
      },
    };
  }

  async findOneStaff(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID không hợp lệ');

    const user = await this.userModel
      .findById(id)
      .select('-password -__v -token_version');
    if (!user) throw new NotFoundException('Nhân sự không tồn tại.');
    return user;
  }

  // 5. ĐỔI TRẠNG THÁI
  async changeStatus(
    id: string,
    dto: ChangeStatusDto,
    actorId: string,
    currentUserRoles: string[],
    ip: string,
    userAgent: string,
  ) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Nhân sự không tồn tại.');

    if (
      !this.isSuperAdmin(currentUserRoles) &&
      (await this.isPrivilegedAccount(user.roles))
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền thay đổi trạng thái của tài khoản quản trị hệ thống.',
      );
    }

    if (id === actorId.toString())
      throw new ForbiddenException(
        'Không thể tự thay đổi trạng thái của chính mình.',
      );

    await this.assertLowerLevelTargets([id], currentUserRoles);

    const oldStatus = user.status;
    user.status = dto.status;

    if (dto.status !== UserStatus.ACTIVE) {
      user.token_version = (user.token_version || 0) + 1;
    }

    await user.save();

    const employeeCode = (user as unknown as Staff).employee_code || 'UNKNOWN';

    await this.auditLogsService.log({
      action: 'CHANGE_STAFF_STATUS',
      collection_name: 'users',
      actor_id: actorId,
      target_id: user._id,
      department: Department.MANAGEMENT,
      detail: {
        employee_code: employeeCode,
        reason: dto.reason,
        old_status: oldStatus,
        new_status: dto.status,
      },
      ip,
      user_agent: userAgent,
    });

    return { message: 'Cập nhật trạng thái thành công.' };
  }

  // Danh sách thao tác hàng loạt có chứa tài khoản đặc quyền → chỉ Super Admin
  private async assertNoPrivilegedTargets(
    targetIds: string[],
    currentUserRoles: string[],
  ): Promise<void> {
    if (this.isSuperAdmin(currentUserRoles)) return;

    const privilegedSlugs = await this.getPrivilegedRoleSlugs();
    const privilegedTargets = await this.userModel.countDocuments({
      _id: { $in: targetIds },
      roles: { $in: privilegedSlugs },
    });
    if (privilegedTargets > 0) {
      throw new ForbiddenException(
        'Trong danh sách chọn có tài khoản quản trị hệ thống. Bạn không có quyền thao tác!',
      );
    }
  }

  // 6. CẬP NHẬT TRẠNG THÁI HÀNG LOẠT
  async bulkChangeStatus(
    dto: BulkChangeStatusDto,
    adminId: string,
    currentUserRoles: string[],
    ip: string,
    userAgent: string,
  ) {
    let targetIds = dto.userIds;
    if (!dto.is_active) {
      targetIds = dto.userIds.filter((id) => id !== adminId.toString());
      if (targetIds.length === 0) {
        throw new ForbiddenException(
          'Bạn không thể tự khóa tài khoản của chính mình.',
        );
      }
    }

    await this.assertNoPrivilegedTargets(targetIds, currentUserRoles);
    await this.assertLowerLevelTargets(targetIds, currentUserRoles);

    const newStatus = dto.is_active ? UserStatus.ACTIVE : UserStatus.SUSPENDED;

    const updateData: {
      $set: { status: UserStatus };
      $inc?: { token_version: number };
    } = {
      $set: { status: newStatus },
    };

    // Nếu khóa (is_active = false), thì tăng token_version để force logout
    if (!dto.is_active) {
      updateData.$inc = { token_version: 1 };
    }

    const result = await this.staffModel.updateMany(
      { _id: { $in: targetIds } },
      updateData,
    );

    await this.auditLogsService.log({
      action: 'BULK_CHANGE_STAFF_STATUS',
      collection_name: 'users',
      actor_id: adminId,
      department: Department.MANAGEMENT,
      detail: {
        target_ids: targetIds,
        new_status: newStatus,
        modified_count: result.modifiedCount,
      },
      ip,
      user_agent: userAgent,
    });

    return {
      message: `Đã cập nhật trạng thái cho ${result.modifiedCount} tài khoản`,
    };
  }

  // 7. XÓA MỀM HÀNG LOẠT
  async bulkSoftDelete(
    dto: BulkDeleteDto,
    adminId: string,
    currentUserRoles: string[],
    ip: string,
    userAgent: string,
  ) {
    const targetIds = dto.userIds.filter((id) => id !== adminId.toString());

    if (targetIds.length === 0) {
      throw new ForbiddenException(
        'Bạn không thể tự xóa tài khoản của chính mình.',
      );
    }

    await this.assertNoPrivilegedTargets(targetIds, currentUserRoles);

    // Xóa mềm: Đổi status thành TERMINATED và force logout
    const result = await this.staffModel.updateMany(
      { _id: { $in: targetIds } },
      {
        $set: { status: UserStatus.TERMINATED },
        $inc: { token_version: 1 },
      },
    );

    await this.auditLogsService.log({
      action: 'BULK_DELETE_STAFF',
      collection_name: 'users',
      actor_id: adminId,
      department: Department.MANAGEMENT,
      detail: {
        target_ids: targetIds,
        reason: 'Bulk soft delete request by Admin',
        modified_count: result.modifiedCount,
      },
      ip,
      user_agent: userAgent,
    });

    return { message: `Đã vô hiệu hóa ${result.modifiedCount} tài khoản` };
  }
}
