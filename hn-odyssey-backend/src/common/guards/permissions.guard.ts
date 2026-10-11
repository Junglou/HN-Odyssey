import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { isReservedRoleKey } from 'src/common/constants/system-roles.constant';
import {
  Role,
  RoleDocument,
} from 'src/modules/users/roles/schemas/role.schema';

export interface RequestUser {
  _id: string;
  email: string;
  roles?: string[];
}

export interface RequestWithUser extends Request {
  user?: RequestUser;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<{
      resource: Resource | Resource[];
      action: Action | Action[];
    }>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Vui lòng đăng nhập để tiếp tục.');
    }

    const userRoleSlugs = Array.isArray(user.roles) ? user.roles : [];

    // 1. Slug dành riêng (chỉ seeder tạo được, API tạo/sửa Role đã chặn)
    if (userRoleSlugs.some((r) => isReservedRoleKey(String(r)))) return true;

    // 2. Lấy chi tiết Role từ DB
    const userRolesDb = await this.roleModel
      .find({ slug: { $in: userRoleSlugs }, is_active: true })
      .select('is_system permissions')
      .exec();

    // 3. Role hệ thống: CHỈ tin cờ is_system, KHÔNG BAO GIỜ tin tên role
    if (userRolesDb.some((r) => r.is_system)) return true;

    // 4. Gộp tất cả quyền của user
    const userPermissions: { resource: string; actions: string[] }[] = [];
    userRolesDb.forEach((role) => {
      if (role.permissions && Array.isArray(role.permissions)) {
        role.permissions.forEach((p: unknown) => {
          if (p && typeof p === 'object') {
            const pObj = p as Record<string, unknown>;
            userPermissions.push({
              resource: String(pObj.resource),
              actions: Array.isArray(pObj.actions)
                ? pObj.actions.map(String)
                : [],
            });
          }
        });
      }
    });

    if (userPermissions.length === 0) {
      throw new ForbiddenException(
        'Tài khoản của bạn chưa được cấp quyền truy cập (Rỗng quyền).',
      );
    }

    // 5. Kiểm tra quyền (OR giữa các resource, OR giữa các action)
    const requiredResources = Array.isArray(requiredPermission.resource)
      ? requiredPermission.resource
      : [requiredPermission.resource];

    const requiredActions = Array.isArray(requiredPermission.action)
      ? requiredPermission.action
      : [requiredPermission.action];

    const hasPermission = userPermissions.some(
      (p) =>
        requiredResources.includes(p.resource as Resource) &&
        (requiredActions.some((reqAct) => p.actions.includes(reqAct)) ||
          p.actions.includes(Action.MANAGE)),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện thao tác này.',
      );
    }

    return true;
  }
}
