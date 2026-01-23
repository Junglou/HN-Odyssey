import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

// 2. Định nghĩa Interface cho User
interface RequestUser {
  roles: string[];
}

// 3. Định nghĩa Request chứa User
interface RequestWithUser extends Request {
  user: RequestUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Lấy Required Roles
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Nếu API không yêu cầu quyền -> Cho qua
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || !user.roles) {
      throw new UnauthorizedException('User không tồn tại hoặc không có roles');
    }

    const superAdminRole = Role.SUPER_ADMIN as unknown as string;

    // Check Super Admin đi cửa sau
    if (user.roles.includes(superAdminRole)) {
      return true;
    }

    const hasRole = requiredRoles.some((role) => {
      // Ép role yêu cầu về string (đề phòng nó là Enum)
      const roleStr = role as unknown as string;
      return user.roles.includes(roleStr);
    });

    if (!hasRole) {
      throw new UnauthorizedException(
        'Tài khoản của bạn không có quyền thực hiện. Vui lòng liên hệ Admin.',
      );
    }

    return true;
  }
}
