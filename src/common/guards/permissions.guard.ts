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
import { Request } from 'express'; // 1. Import Request
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import {
  Role,
  RoleDocument,
} from 'src/modules/users/roles/schemas/role.schema';
import { Role as RoleEnum } from 'src/common/enums/role.enum';
import { Action } from 'src/common/enums/resource.enum';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// 2. Định nghĩa Interface cho User
interface RequestUser {
  email: string;
  roles: string[];
  userId: string;
}

// 3. Định nghĩa Request có chứa User
interface RequestWithUser extends Request {
  user: RequestUser;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }
    const requiredPermission = this.reflector.getAllAndOverride<{
      resource: string;
      action: string;
    }>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermission) {
      return true;
    }

    // Thay vì: const { user } = context.switchToHttp().getRequest();
    // Ta dùng Generics để báo cho TS biết kiểu trả về chính xác
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // Lúc này user đã có kiểu RequestUser, truy cập .roles hay .email đều an toàn
    if (!user || !user.roles || !Array.isArray(user.roles)) {
      throw new ForbiddenException('User không hợp lệ hoặc không có vai trò.');
    }

    // Ép kiểu Enum về string để so sánh với mảng string (user.roles)
    const superAdminRole = RoleEnum.SUPER_ADMIN as unknown as string;
    if (user.roles.includes(superAdminRole)) {
      return true;
    }

    const userRoles = await this.roleModel
      .find({
        slug: { $in: user.roles },
        is_active: true,
      })
      .select('permissions slug')
      .exec();

    if (!userRoles || userRoles.length === 0) {
      throw new ForbiddenException(
        'Vai trò của bạn không tồn tại hoặc đã bị khóa.',
      );
    }

    const hasPermission = userRoles.some((role) => {
      const permission = role.permissions.find(
        (p) =>
          (p.resource as unknown as string) ===
          (requiredPermission.resource as unknown as string),
      );
      if (!permission) return false;

      // Ép kiểu mảng Enum từ DB về mảng string để so sánh an toàn
      const allowedActions = permission.actions as unknown as string[];
      const manageAction = Action.MANAGE as unknown as string;
      const currentAction = requiredPermission.action;

      // So sánh string với string -> Hợp lệ 100%
      return (
        allowedActions.includes(currentAction) ||
        allowedActions.includes(manageAction)
      );
    });

    if (!hasPermission) {
      this.logger.warn(
        `User [${user.email}] - Roles [${user.roles.join(', ')}] tried to [${
          requiredPermission.action
        }] on [${requiredPermission.resource}] -> DENIED`,
      );
      throw new ForbiddenException(
        `Bạn không có quyền thực hiện thao tác này.`,
      );
    }

    return true;
  }
}
