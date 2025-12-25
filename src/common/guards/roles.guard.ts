import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Lấy Required Roles
    // Lưu ý: Nếu file decorator dùng string 'roles', hãy thay ROLES_KEY bằng 'roles'
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Lấy thông tin Request
    const { user } = context.switchToHttp().getRequest();

    // --- DEBUG LOG (Xem kết quả ở Terminal) ---
    // console.log('========== DEBUG ROLES GUARD ==========');
    // console.log('1. Required Roles (Yêu cầu):', requiredRoles);
    // console.log('2. User Info (Trong Token):', user);
    // console.log('3. User Roles (Mảng quyền):', user?.roles);
    // console.log('=======================================');

    // Nếu API không yêu cầu quyền -> Cho qua
    if (!requiredRoles) {
      return true;
    }

    if (!user || !user.roles) {
      throw new UnauthorizedException('User không tồn tại hoặc không có roles');
    }

    //Super Admin đi cửa sau
    if (user.roles.includes(Role.SUPER_ADMIN)) {
      console.log('>>> PASSED: God Mode Activated (Super Admin)');
      return true;
    }

    // Logic so sánh
    const hasRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRole) {
      console.log('>>> FAILED: Không khớp quyền');
      throw new UnauthorizedException(
        'Tài khoản của bạn không có quyền thực hiện. Vui lòng liên hệ Admin.',
      );
    }

    console.log('>>> PASSED: Hợp lệ');
    return true;
  }
}
