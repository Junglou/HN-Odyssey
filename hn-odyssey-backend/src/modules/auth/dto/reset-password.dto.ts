import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { Match } from 'src/common/decorators/match.decorator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'customer@example.com HOẶC 0987654321',
    description: 'Email HOẶC Số điện thoại đã đăng ký (AC1)',
  })
  @IsNotEmpty({ message: 'Thông tin khôi phục không được để trống' })
  @IsString({ message: 'Thông tin khôi phục phải là chuỗi' })
  account: string;

  @ApiProperty({ example: '123456', description: 'Mã OTP hoặc Token từ Email' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Mật khẩu phải bao gồm chữ hoa, chữ thường và số',
  })
  newPassword: string;

  @IsNotEmpty({ message: 'Xác nhận mật khẩu mới không được để trống' })
  @Match('newPassword', { message: 'Mật khẩu nhập lại không khớp ' })
  confirmNewPassword: string;
}
