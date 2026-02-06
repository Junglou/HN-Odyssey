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
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'; // 👈 1. Import Key Public

// Interface User & Request (Giữ nguyên như bạn đã làm)
interface RequestUser {
  roles: string[];
}
interface RequestWithUser extends Request {
  user: RequestUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 👇 2. THÊM ĐOẠN CHECK PUBLIC NÀY VÀO ĐẦU HÀM
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // Nếu là Public -> Cho qua luôn, không cần check Role
    }
    // 👆 HẾT PHẦN THÊM

    // --- Logic cũ giữ nguyên ---
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || !user.roles) {
      throw new UnauthorizedException('User không tồn tại hoặc không có roles');
    }

    const superAdminRole = Role.SUPER_ADMIN as unknown as string;
    if (user.roles.includes(superAdminRole)) {
      return true;
    }

    const hasRole = requiredRoles.some((role) => {
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
