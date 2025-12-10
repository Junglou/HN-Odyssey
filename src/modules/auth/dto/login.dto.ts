import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
export class LoginDto {
  @IsNotEmpty({ message: 'Tài khoản không được để trống' })
  @IsString({ message: 'Tài khoản phải là dạng chuỗi ký tự' })
  account: string;

  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString({ message: 'Mật khẩu phải là dạng chuỗi ký tự' })
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe: boolean;
}
