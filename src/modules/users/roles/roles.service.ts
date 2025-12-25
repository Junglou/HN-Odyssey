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

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

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

    const exist = await this.roleModel.findOne({ slug });
    if (exist) throw new ConflictException(`Vai trò '${slug}' đã tồn tại.`);

    const newRole = new this.roleModel({
      ...dto,
      slug,
      is_system: false,
    });
    const savedRole = await newRole.save();

    //Ghi Log
    await this.auditLogsService.log({
      action: 'CREATE_ROLE',
      collection_name: 'roles',
      actor_id: actorId,
      target_id: savedRole._id,
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
    }

    // Check trùng Slug
    if (dto.slug && dto.slug.toUpperCase() !== role.slug) {
      const newSlug = dto.slug.toUpperCase();
      const existSlug = await this.roleModel.findOne({ slug: newSlug });
      if (existSlug)
        throw new ConflictException(`Slug '${newSlug}' đã tồn tại`);
      role.slug = newSlug;
    }

    if (dto.name) role.name = dto.name;
    if (dto.description) role.description = dto.description;
    if (typeof dto.is_active !== 'undefined') role.is_active = dto.is_active;
    if (dto.permissions) role.permissions = dto.permissions;

    await role.save();

    // Ghi Log Update
    await this.auditLogsService.log({
      action: 'UPDATE_ROLE',
      collection_name: 'roles',
      actor_id: actorId,
      target_id: role._id,
      detail: {
        updated_role: role.slug,
        changes: dto,
      },
      ip,
      user_agent: userAgent,
    });

    return role;
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
      detail: { role_name: role.name, role_slug: role.slug },
      ip,
      user_agent: userAgent,
    });

    return { message: 'Đã xóa vai trò thành công' };
  }
}
