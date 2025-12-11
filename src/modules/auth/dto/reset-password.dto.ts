import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { Match } from 'src/common/decorators/match.decorator';

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'Token xác thực không được để trống' })
  @IsString()
  token: string;

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
