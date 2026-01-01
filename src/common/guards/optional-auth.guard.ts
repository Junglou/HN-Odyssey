import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info, context) {
    // Nếu có lỗi hoặc không có user (không có token), ta KHÔNG báo lỗi (throw err)
    // Mà trả về null để Controller tự xử lý
    if (err || !user) {
      return null;
    }
    return user;
  }
}
