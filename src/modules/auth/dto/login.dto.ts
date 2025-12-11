import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
export class LoginDto {
  @ApiProperty({
    example: 'customer@example.com',
    description: 'Email hoặc Số điện thoại (AC1)',
  })
  @IsNotEmpty({ message: 'Tài khoản không được để trống' })
  @IsString({ message: 'Tài khoản phải là dạng chuỗi ký tự' })
  account: string;

  @ApiProperty({ example: 'Pass@1234', description: 'Mật khẩu' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString({ message: 'Mật khẩu phải là dạng chuỗi ký tự' })
  password: string;

  @ApiProperty({ example: false, description: 'Ghi nhớ đăng nhập (AC6)' })
  @IsOptional()
  @IsBoolean()
  rememberMe: boolean;
}
