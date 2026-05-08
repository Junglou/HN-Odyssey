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
  // [FIX UNSAFE]: Dùng 'unknown' thay vì 'any' để Eslint không báo lỗi gán unsafe
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
    if (!currentUserRoles.includes(RoleEnum.SUPER_ADMIN)) {
      if (dto.roles.includes(RoleEnum.SUPER_ADMIN)) {
        throw new ForbiddenException(
          'Không có quyền tạo tài khoản Super Admin.',
        );
      }
    }

    const validRoles = await this.roleModel
      .find({
        slug: { $in: dto.roles },
        is_active: true,
      })
      .select('level slug');

    if (validRoles.length !== dto.roles.length) {
      throw new BadRequestException('Một hoặc nhiều vai trò không hợp lệ.');
    }

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

    const newStaff = new this.staffModel({
      employee_code: finalEmployeeCode,
      email: dto.email,
      phone: dto.phone,
      first_Name: dto.firstName,
      last_Name: dto.lastName,
      password: hashedPassword,
      roles: dto.roles,
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

    if (dto.roles && !currentUserRoles.includes(RoleEnum.SUPER_ADMIN)) {
      if (dto.roles.includes(RoleEnum.SUPER_ADMIN)) {
        throw new ForbiddenException(
          'Bạn không có quyền chỉ định vai trò Super Admin.',
        );
      }
    }

    if (id === currentUserId.toString() && dto.is_active === false) {
      throw new ForbiddenException('Không thể tự khóa chính mình.');
    }

    // [FIX UNSAFE]: Cast to Record<string, unknown> để tương thích với getDiff mới
    const oldData = user.toObject() as unknown as Record<string, unknown>;

    if (dto.roles) {
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

    if (dto.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(dto.password, salt);
    }

    if (typeof dto.is_active !== 'undefined') {
      user.status = dto.is_active ? UserStatus.ACTIVE : UserStatus.SUSPENDED;
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
    if (dto.roles) user.roles = dto.roles;

    try {
      await user.save();
    } catch (error: unknown) {
      const mongoError = error as MongoError;
      if (mongoError.code === 11000)
        throw new ConflictException('Dữ liệu (SĐT hoặc Mã) đã tồn tại.');
      throw new InternalServerErrorException(error);
    }

    // [FIX UNSAFE]: Cast dto to Record<string, unknown>
    // Hàm getDiff đã trả về Record<string, any> nên biến diff không bị unsafe assignment
    const diff = this.getDiff(
      oldData,
      dto as unknown as Record<string, unknown>,
    );

    // oldData giờ là unknown, nên khi so sánh cần ép kiểu hoặc check
    if ((oldData.employee_code as string) !== user.employee_code) {
      diff['employee_code'] = {
        old: oldData.employee_code,
        new: user.employee_code,
      };
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

    if (diff['roles']) {
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
    ip: string,
    userAgent: string,
  ) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Nhân sự không tồn tại.');

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
      filter.$or = [
        { email: { $regex: search, $options: 'i' } }, // Tìm theo email (không phân biệt hoa thường)
        { first_Name: { $regex: search, $options: 'i' } }, // Tìm theo tên
        { last_Name: { $regex: search, $options: 'i' } }, // Tìm theo họ
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
        // [FIXED] Chỉ lấy những tài khoản bị KHÓA, tuyệt đối KHÔNG lấy tài khoản đã XÓA
        filter.status = UserStatus.SUSPENDED;
      }
    } else {
      // [FIXED] BẮT BUỘC: Mặc định luôn ẩn các tài khoản đã bị xóa (Terminated)
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
    ip: string,
    userAgent: string,
  ) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Nhân sự không tồn tại.');

    if (id === actorId.toString())
      throw new ForbiddenException(
        'Không thể tự thay đổi trạng thái của chính mình.',
      );

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

  // 6. CẬP NHẬT TRẠNG THÁI HÀNG LOẠT
  async bulkChangeStatus(
    dto: BulkChangeStatusDto,
    adminId: string,
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

    const newStatus = dto.is_active ? UserStatus.ACTIVE : UserStatus.SUSPENDED;

    // Định nghĩa rõ type thay vì dùng 'any' để Eslint hết báo lỗi unsafe
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
      { _id: { $in: targetIds } }, // Chỉ update những ID đã được lọc
      updateData,
    );

    // 2. Ghi Audit Log chuẩn theo DTO của hệ thống
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
    ip: string,
    userAgent: string,
  ) {
    const targetIds = dto.userIds.filter((id) => id !== adminId.toString());

    // THÊM ĐOẠN NÀY ĐỂ CHẶN ADMIN TỰ SÁT:
    if (targetIds.length === 0) {
      throw new ForbiddenException(
        'Bạn không thể tự xóa tài khoản của chính mình.',
      );
    }

    // Xóa mềm: Đổi status thành TERMINATED và force logout
    const result = await this.staffModel.updateMany(
      { _id: { $in: targetIds } },
      {
        $set: { status: UserStatus.TERMINATED },
        $inc: { token_version: 1 },
      },
    );

    // Ghi Audit Log chuẩn
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
