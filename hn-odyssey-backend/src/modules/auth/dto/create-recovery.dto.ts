import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRecoveryDto {
  @ApiProperty({
    example: 'acc_cu_bi_mat@example.com',
    description: 'Tài khoản bị mất',
  })
  @IsNotEmpty()
  @IsString()
  target_account: string;

  @ApiProperty({
    example: 'email_moi@example.com',
    description: 'Email nhận kết quả',
  })
  @IsNotEmpty()
  @IsEmail()
  contact_email: string;

  @ApiProperty({
    example: 'Tôi bị mất điện thoại và quên mật khẩu',
    description: 'Lý do',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;

  // Lưu ý: File upload sẽ được xử lý riêng qua Interceptor, không nằm trong body JSON
}
