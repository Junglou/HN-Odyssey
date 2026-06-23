import { IsString, IsNotEmpty, Length, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'customer@example.com',
    description: 'Email hoặc SĐT cần xác thực',
  })
  @IsNotEmpty()
  @IsString()
  account: string;

  @ApiProperty({ example: '123456', description: 'Mã OTP 6 số' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'Mã OTP phải có đúng 6 ký tự' })
  code: string;

  @ApiProperty({ example: 'REGISTER', enum: ['REGISTER', 'RESET_PASSWORD'] })
  @IsNotEmpty()
  @IsEnum(['REGISTER', 'RESET_PASSWORD'], {
    message: 'Loại xác thực không hợp lệ',
  })
  type: string;
}
