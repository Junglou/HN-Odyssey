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
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

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
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || !user.roles) {
      throw new UnauthorizedException('User không tồn tại hoặc không có roles');
    }

    // VẪN GIỮ ĐẶC QUYỀN SUPER_ADMIN NHƯ BẠN YÊU CẦU
    const superAdminRole = Role.SUPER_ADMIN as unknown as string;
    if (user.roles.includes(superAdminRole)) {
      return true;
    }

    const hasRole = requiredRoles.some((role) => {
      const roleStr = role as unknown as string;

      // LOGIC CHỐT CHẶN:
      // Nếu API (như Wishlist, Profile) đang yêu cầu quyền CUSTOMER
      // Thì cho phép TOÀN BỘ user đã vượt qua được bước check Token truy cập (Bao gồm Staff, Admin, TEST).
      if (roleStr === 'CUSTOMER') {
        return true;
      }

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
