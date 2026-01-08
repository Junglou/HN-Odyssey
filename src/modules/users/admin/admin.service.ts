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
import { Model, Types } from 'mongoose';
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

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Staff.name) private readonly staffModel: Model<Staff>,
    private readonly auditLogsService: AuditLogsService,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
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

    // Lấy level cao nhất từ danh sách roles
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
      value: dept, // Gửi xuống DB: 'MANAGEMENT'
      label: DEPARTMENT_LABELS[dept], // Hiển thị: 'Ban quản trị'
      code: DEPARTMENT_CODES[dept], // Metadata nếu cần: '1'
    }));
  };

  // HELPER: So sánh sự thay đổi dữ liệu để ghi log
  private getDiff(oldData: any, newData: any) {
    const diff: any = {};
    // Chỉ so sánh các key có trong DTO gửi lên
    Object.keys(newData).forEach((key) => {
      // Bỏ qua các trường không cần thiết hoặc nhạy cảm
      if (['password', 'confirm_password'].includes(key)) return;

      const oldVal = oldData[key];
      const newVal = newData[key];

      // So sánh giá trị (dùng JSON.stringify để so sánh cả mảng/object)
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
    // 1. Check quyền Super Admin
    if (!currentUserRoles.includes(RoleEnum.SUPER_ADMIN)) {
      if (dto.roles.includes(RoleEnum.SUPER_ADMIN)) {
        throw new ForbiddenException(
          'Không có quyền tạo tài khoản Super Admin.',
        );
      }
    }

    // 2. Validate Roles & Lấy Level
    // Thay vì count, ta find để lấy luôn field 'level' phục vụ sinh mã
    const validRoles = await this.roleModel
      .find({
        slug: { $in: dto.roles },
        is_active: true,
      })
      .select('level slug');

    if (validRoles.length !== dto.roles.length) {
      throw new BadRequestException('Một hoặc nhiều vai trò không hợp lệ.');
    }

    // 3. Check trùng Email
    const existUser = await this.userModel.findOne({ email: dto.email });
    if (existUser) throw new ConflictException('Email đã tồn tại.');

    // 4. GENERATE MÃ NHÂN VIÊN
    const initials = this.getInitials(dto.lastName, dto.firstName);
    const deptCode = this.getDepartmentCode(dto.department);

    // Lấy level cao nhất (số bé nhất). Mặc định Staff (3) nếu role chưa config level
    const roleLevels = validRoles.map((r) => r.level || RoleLevel.STAFF);
    const minLevel = Math.min(...roleLevels);

    const codePrefix = `${initials}-${deptCode}-${minLevel}`;

    // b. Tìm số thứ tự tiếp theo cho Prefix này
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

    // 5. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    // 6. Init Object
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

    // 7. Save & Handle Race Condition
    let savedUser;
    try {
      savedUser = await newStaff.save();
    } catch (error) {
      if (error.code === 11000) {
        if (error.keyPattern.employee_code) {
          throw new ConflictException(
            `Hệ thống bận (Trùng mã ${finalEmployeeCode}). Vui lòng thử lại.`,
          );
        }
        if (error.keyPattern.email)
          throw new ConflictException(`Email '${dto.email}' đã tồn tại.`);
        if (error.keyPattern.phone)
          throw new ConflictException(`SĐT '${dto.phone}' đã tồn tại.`);
      }
      throw new InternalServerErrorException(error);
    }

    // 8. Audit Log
    await this.auditLogsService.log({
      action: 'CREATE_STAFF',
      collection_name: 'users',
      actor_id: createdById,
      target_id: savedUser._id,
      actor_employee_code: savedUser.employee_code,
      department: Department.MANAGEMENT,
      detail: {
        email: savedUser.email,
        roles: savedUser.roles,
        employee_code: savedUser.employee_code,
        department: savedUser.department,
      },
      ip,
      user_agent: userAgent,
    });

    return {
      message: 'Tạo tài khoản Staff thành công.',
      data: {
        _id: savedUser._id,
        email: savedUser.email,
        employeeCode: savedUser.employee_code,
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

    // 1. Kiểm tra quyền Super Admin
    if (dto.roles && !currentUserRoles.includes(RoleEnum.SUPER_ADMIN)) {
      if (dto.roles.includes(RoleEnum.SUPER_ADMIN)) {
        throw new ForbiddenException(
          'Bạn không có quyền chỉ định vai trò Super Admin.',
        );
      }
    }

    if (id === currentUserId && dto.is_active === false) {
      throw new ForbiddenException('Không thể tự khóa chính mình.');
    }

    const oldData = user.toObject();

    //LOGIC KIỂM TRA ĐỔI MÃ: CHỈ KHI ROLE LEVEL THAY ĐỔI
    if (dto.roles) {
      // 1. Lấy Level hiện tại đang có trong mã nhân viên cũ
      const currentLevelStr = user.employee_code.split('-')[2];

      // 2. Tính Level mới dựa trên roles gửi lên
      const validRoles = await this.roleModel
        .find({ slug: { $in: dto.roles }, is_active: true })
        .select('level');

      const roleLevels = validRoles.map((r) => r.level || RoleLevel.STAFF);
      const newMinLevel = Math.min(...roleLevels);

      // 3. So sánh: Chỉ sinh mã mới nếu Level thực sự thay đổi
      if (currentLevelStr && newMinLevel.toString() !== currentLevelStr) {
        user.employee_code = await this.generateEmployeeCode(
          user.last_Name,
          user.first_Name,
          user.department,
          dto.roles,
        );
      }
    }

    // 3. Cập nhật các trường thông tin khác (Sau khi đã xử lý mã xong xuôi)
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

    // Các thông tin cá nhân thay đổi thoải mái, không ảnh hưởng mã nữa
    if (dto.phone) user.phone = dto.phone;
    if (dto.firstName) user.first_Name = dto.firstName;
    if (dto.lastName) user.last_Name = dto.lastName;
    if (dto.department) user.department = dto.department;
    if (dto.roles) user.roles = dto.roles;

    // 4. Lưu và Ghi Log
    try {
      await user.save();
    } catch (error) {
      if (error.code === 11000)
        throw new ConflictException('Dữ liệu (SĐT hoặc Mã) đã tồn tại.');
      throw new InternalServerErrorException(error);
    }

    const diff = this.getDiff(oldData, dto);

    // Ghi log nếu mã thay đổi
    if (oldData.employee_code !== user.employee_code) {
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

    if (id === currentUserId) {
      throw new ForbiddenException(
        'Bạn không thể tự vô hiệu hóa tài khoản của chính mình.',
      );
    }

    const oldStatus = user.status;
    user.status = UserStatus.TERMINATED;
    user.token_version = (user.token_version || 0) + 1;

    await user.save();

    await this.auditLogsService.log({
      action: 'DELETE_STAFF',
      collection_name: 'users',
      actor_id: currentUserId,
      target_id: id,
      department: Department.MANAGEMENT,
      detail: {
        employee_code: (user as any).employee_code,
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
    } = query as any;

    const skip = (page - 1) * Number(limit);
    const filter: any = { type: 'Staff' };

    // 1. Tìm kiếm chung (Full-text Search)
    if (search) {
      filter.$text = { $search: search };
    }

    // 2. Lọc riêng theo Mã Nhân Viên (Tìm chính xác 1 phần)
    if (employee_code) {
      filter.employee_code = { $regex: employee_code, $options: 'i' };
    }

    // 3. Các bộ lọc khác
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
        filter.status = { $in: [UserStatus.SUSPENDED, UserStatus.TERMINATED] };
      }
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

  // 5. ĐỔI TRẠNG THÁI (Change Status)
  async changeStatus(
    id: string,
    dto: ChangeStatusDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Nhân sự không tồn tại.');

    if (id === actorId)
      throw new ForbiddenException(
        'Không thể tự thay đổi trạng thái của chính mình.',
      );

    const oldStatus = user.status;
    user.status = dto.status;

    // Nếu block/inactive thì kích token cũ ra
    if (dto.status !== UserStatus.ACTIVE) {
      user.token_version = (user.token_version || 0) + 1;
    }

    await user.save();

    await this.auditLogsService.log({
      action: 'CHANGE_STAFF_STATUS',
      collection_name: 'users',
      actor_id: actorId,
      target_id: user._id,
      department: Department.MANAGEMENT,
      detail: {
        employee_code: (user as any).employee_code,
        reason: dto.reason,
        old_status: oldStatus,
        new_status: dto.status,
      },
      ip,
      user_agent: userAgent,
    });

    return { message: 'Cập nhật trạng thái thành công.' };
  }
}
