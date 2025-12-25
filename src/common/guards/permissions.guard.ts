import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import {
  Role,
  RoleDocument,
} from 'src/modules/users/roles/schemas/role.schema';
import { Role as RoleEnum } from 'src/common/enums/role.enum';
import { Action } from 'src/common/enums/resource.enum'; // Import Action Enum chuẩn

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<{
      resource: string;
      action: string;
    }>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // 1. API Public hoặc không yêu cầu quyền cụ thể
    if (!requiredPermission) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Check user tồn tại (đã qua JwtAuthGuard)
    if (!user || !user.roles || !Array.isArray(user.roles)) {
      throw new ForbiddenException('User không hợp lệ hoặc không có vai trò.');
    }

    // 2. SUPER_ADMIN Bypass (Check nhanh từ Token)
    if (user.roles.includes(RoleEnum.SUPER_ADMIN)) {
      return true;
    }

    // 3. Query DB để lấy Permissions mới nhất (Real-time check)
    // Chỉ lấy field permissions để tối ưu query
    const userRoles = await this.roleModel
      .find({
        slug: { $in: user.roles },
        is_active: true,
      })
      .select('permissions slug');

    // Nếu không tìm thấy role nào active (hoặc user bị gán role rác)
    if (!userRoles || userRoles.length === 0) {
      throw new ForbiddenException(
        'Vai trò của bạn không tồn tại hoặc đã bị khóa.',
      );
    }

    // 4. Logic kiểm tra quyền chi tiết
    const hasPermission = userRoles.some((role) => {
      // Tìm permission match với Resource
      const permission = role.permissions.find(
        (p) => p.resource === requiredPermission.resource,
      );
      if (!permission) return false;

      // Check Action: Cho phép nếu có Action cụ thể HOẶC có quyền MANAGE (Quản lý tất cả)
      return (
        permission.actions.includes(requiredPermission.action as Action) ||
        permission.actions.includes(Action.MANAGE) // Đảm bảo Enum có MANAGE
      );
    });

    if (!hasPermission) {
      this.logger.warn(
        `User [${user.email}] - Roles [${user.roles}] tried to [${requiredPermission.action}] on [${requiredPermission.resource}] -> DENIED`,
      );
      throw new ForbiddenException(
        `Bạn không có quyền thực hiện thao tác này.`,
      );
    }

    return true;
  }
}
