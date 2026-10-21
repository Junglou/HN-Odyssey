import { PickType } from '@nestjs/swagger';
import { ChangePasswordDto } from './change-password.dto';

// Đặt mật khẩu lần đầu cho tài khoản tạo bằng Google/Facebook.
// Chỉ lấy field newPassword và dùng lại đúng quy tắc kiểm tra của ChangePasswordDto.
export class SetPasswordDto extends PickType(ChangePasswordDto, [
  'newPassword',
] as const) {}
