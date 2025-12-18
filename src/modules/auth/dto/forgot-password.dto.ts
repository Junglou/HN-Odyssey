import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'customer@example.com HOẶC 0987654321',
    description: 'Email HOẶC Số điện thoại đã đăng ký (AC1)',
  })
  @IsNotEmpty({ message: 'Thông tin khôi phục không được để trống' })
  @IsString({ message: 'Thông tin khôi phục phải là chuỗi' })
  account: string;
}
