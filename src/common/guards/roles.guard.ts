import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Lấy vai trò yêu cầu từ Decorator @Roles()
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    if (!requiredRoles) {
      return true;
    }

    // 2. Lấy thông tin user (payload JWT) từ request
    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.roles) {
      return false;
    }

    // 3. So sánh vai trò của user với vai trò yêu cầu
    return requiredRoles.some((role) => user.roles.includes(role));
    // Nếu requiredRoles là ['ADMIN'] và user.roles là ['CUSTOMER', 'ADMIN'],
    // thì logic này vẫn trả về true -> Hoạt động đúng.
  }
}
