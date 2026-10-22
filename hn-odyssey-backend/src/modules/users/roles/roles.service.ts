import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from './schemas/role.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { AuditLogsService } from '../../system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';
import { isReservedRoleKey } from 'src/common/constants/system-roles.constant';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { RoleLevel } from 'src/common/enums/role-level.enum';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // Phương án A: READ là quyền tiên quyết. Có bất kỳ action nào trên resource thì luôn kèm READ.
  // Đồng thời gộp resource trùng lặp và bỏ resource không còn action nào.
  private normalizePermissions(
    permissions: { resource: Resource; actions: Action[] }[] = [],
  ): { resource: Resource; actions: Action[] }[] {
    const merged = new Map<Resource, Set<Action>>();

    permissions.forEach((p) => {
      if (!merged.has(p.resource)) merged.set(p.resource, new Set<Action>());
      (p.actions ?? []).forEach((a) => merged.get(p.resource)!.add(a));
    });

    return Array.from(merged.entries())
      .filter(([, actions]) => actions.size > 0)
      .map(([resource, actions]) => {
        if (!actions.has(Action.MANAGE)) actions.add(Action.READ);
        return { resource, actions: Array.from(actions) };
      });
  }

  // 1. TẠO ROLE MỚI
  async create(
    dto: CreateRoleDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
    //Thêm tham số log
    const slug = dto.slug
      ? dto.slug.toUpperCase()
      : dto.name.toUpperCase().replace(/\s+/g, '_');

    if (isReservedRoleKey(slug)) {
      throw new ForbiddenException(
        `Slug '${slug}' được dành riêng cho hệ thống.`,
      );
    }

    const exist = await this.roleModel.findOne({ slug });
    if (exist) throw new ConflictException(`Vai trò '${slug}' đã tồn tại.`);

    const newRole = new this.roleModel({
      ...dto,
      permissions: this.normalizePermissions(dto.permissions),
      slug,
      is_system: false,
      is_active: dto.is_active !== undefined ? dto.is_active : true,
    });
    const savedRole = await newRole.save();

    //Ghi Log
    await this.auditLogsService.log({
      action: 'CREATE_ROLE',
      collection_name: 'roles',
      actor_id: actorId,
      target_id: savedRole._id,
      department: Department.MANAGEMENT,
      detail: {
        name: savedRole.name,
        slug: savedRole.slug,
        permissions: savedRole.permissions,
      },
      ip,
      user_agent: userAgent,
    });

    return savedRole;
  }

  // 2. LẤY DANH SÁCH (AC1)
  async findAll() {
    const roles = await this.roleModel.find().sort({ createdAt: -1 }).lean();
    const result = await Promise.all(
      roles.map(async (role) => {
        const userCount = await this.userModel.countDocuments({
          roles: role.slug,
        });
        return { ...role, userCount };
      }),
    );
    return result;
  }

  // 3. CHI TIẾT ROLE
  async findOne(id: string) {
    const role = await this.roleModel.findById(id);
    if (!role) throw new NotFoundException('Role không tồn tại');
    return role;
  }

  // 4. CẬP NHẬT (AC3)
  async update(
    id: string,
    dto: UpdateRoleDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
    const role = await this.roleModel.findById(id);
    if (!role) throw new NotFoundException('Role không tồn tại');

    //Không cho phép sửa Role hệ thống
    if (role.is_system) {
      if (dto.slug || dto.permissions) {
        throw new ForbiddenException(
          'Không thể thay đổi Slug hoặc Quyền hạn của Role Hệ thống.',
        );
      }
      if (dto.is_active === false) {
        throw new ForbiddenException('Không thể vô hiệu hóa Role hệ thống.');
      }
    }

    // Không cho đổi slug sang slug dành riêng
    if (dto.slug && !role.is_system && isReservedRoleKey(dto.slug)) {
      throw new ForbiddenException(
        `Slug '${dto.slug}' được dành riêng cho hệ thống.`,
      );
    }

    // Check trùng Slug
    if (dto.slug && dto.slug.toUpperCase() !== role.slug) {
      const newSlug = dto.slug.toUpperCase();
      const existSlug = await this.roleModel.findOne({ slug: newSlug });
      if (existSlug)
        throw new ConflictException(`Slug '${newSlug}' đã tồn tại`);
      role.slug = newSlug;
    }

    // Trạng thái chỉ được đổi qua PATCH :id/status (quyền CHANGE_STATUS).
    // Gửi is_active KHÁC trạng thái hiện tại qua API sửa → chặn.
    if (
      typeof dto.is_active !== 'undefined' &&
      dto.is_active !== (role.is_active !== false)
    ) {
      throw new ForbiddenException(
        'Không thể đổi trạng thái qua chức năng sửa vai trò. Vui lòng dùng nút Bật/Tắt trạng thái.',
      );
    }

    if (dto.name) role.name = dto.name;
    if (dto.description) role.description = dto.description;
    if (dto.permissions)
      role.permissions = this.normalizePermissions(dto.permissions);

    await role.save();

    // Ghi Log Update
    await this.auditLogsService.log({
      action: 'UPDATE_ROLE',
      collection_name: 'roles',
      actor_id: actorId,
      target_id: role._id,
      department: Department.MANAGEMENT,
      detail: {
        updated_role: role.slug,
        changes: dto,
      },
      ip,
      user_agent: userAgent,
    });

    return role;
  }

  // Cấp cao nhất (số nhỏ nhất) trong các role của người thao tác
  private async getHighestLevel(roleSlugs: string[] = []): Promise<number> {
    if (roleSlugs.length === 0) return RoleLevel.STAFF;
    const roles = await this.roleModel
      .find({ slug: { $in: roleSlugs } })
      .select('level')
      .lean<Array<{ level?: number }>>();
    if (roles.length === 0) return RoleLevel.STAFF;
    return Math.min(...roles.map((r) => r.level ?? RoleLevel.STAFF));
  }

  // 4b. BẬT/TẮT TRẠNG THÁI VAI TRÒ
  async changeStatus(
    id: string,
    isActive: boolean,
    actorId: string,
    actorRoles: string[],
    ip: string,
    userAgent: string,
  ) {
    const role = await this.roleModel.findById(id);
    if (!role) throw new NotFoundException('Role không tồn tại');

    if (role.is_system) {
      throw new ForbiddenException(
        'Không thể thay đổi trạng thái Role hệ thống.',
      );
    }

    // Chỉ được thao tác trên vai trò có cấp THẤP HƠN mình (Super Admin bỏ qua)
    if (!actorRoles.some((r) => isReservedRoleKey(r))) {
      const actorLevel = await this.getHighestLevel(actorRoles);
      if ((role.level ?? RoleLevel.STAFF) <= actorLevel) {
        throw new ForbiddenException(
          'Bạn chỉ được thay đổi trạng thái của vai trò có cấp bậc thấp hơn mình.',
        );
      }
    }

    const oldIsActive = role.is_active !== false;
    if (oldIsActive === isActive) {
      return { message: 'Trạng thái không thay đổi.', role };
    }

    role.is_active = isActive;
    await role.save();

    // Tắt role = mọi nhân sự giữ role này mất quyền tương ứng ngay lập tức
    const affectedUsers = await this.userModel.countDocuments({
      roles: role.slug,
    });

    await this.auditLogsService.log({
      action: 'CHANGE_ROLE_STATUS',
      collection_name: 'roles',
      actor_id: actorId,
      target_id: role._id,
      department: Department.MANAGEMENT,
      detail: {
        role_slug: role.slug,
        old_is_active: oldIsActive,
        new_is_active: isActive,
        affected_users: affectedUsers,
      },
      ip,
      user_agent: userAgent,
    });

    return {
      message: isActive
        ? 'Đã kích hoạt vai trò.'
        : `Đã vô hiệu hóa vai trò (${affectedUsers} nhân sự bị ảnh hưởng).`,
      role,
    };
  }

  // 5. XÓA (AC4, AC5)
  async remove(id: string, actorId: string, ip: string, userAgent: string) {
    //Thêm tham số log
    const role = await this.roleModel.findById(id);
    if (!role) throw new NotFoundException('Vai trò không tồn tại.');

    if (role.is_system) {
      throw new ForbiddenException(
        'Không thể xóa Vai trò hệ thống (Super Admin).',
      );
    }

    const userCount = await this.userModel.countDocuments({ roles: role.slug });
    if (userCount > 0) {
      throw new BadRequestException(
        `Đang có ${userCount} nhân sự giữ vai trò này. Vui lòng chuyển họ sang vai trò khác trước khi xóa.`,
      );
    }

    await this.roleModel.findByIdAndDelete(id);

    //Ghi Log Delete
    await this.auditLogsService.log({
      action: 'DELETE_ROLE',
      collection_name: 'roles',
      actor_id: actorId,
      target_id: id,
      department: Department.MANAGEMENT,
      detail: { role_name: role.name, role_slug: role.slug },
      ip,
      user_agent: userAgent,
    });

    return { message: 'Đã xóa vai trò thành công' };
  }

  // 6. LẤY DROPDOWN CHO QUẢN LÝ USER (Chỉ lấy Name và Slug)
  async getDropdownOptions() {
    return this.roleModel
      .find({ is_active: true })
      .select('_id name slug')
      .sort({ createdAt: -1 })
      .lean();
  }
}
