import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Match } from 'src/common/decorators/match.decorator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'Văn A',
    description: 'Tên (và tên đệm) của người dùng',
  })
  @IsNotEmpty({ message: 'Tên không được để trống' })
  @IsString({ message: 'Tên phải là dạng chuỗi ký tự' })
  firstName: string;

  @ApiProperty({
    example: 'Nguyễn',
    description: 'Họ của người dùng',
  })
  @IsNotEmpty({ message: 'Họ không được để trống' })
  @IsString({ message: 'Họ phải là dạng chuỗi ký tự' })
  lastName: string;

  @ApiProperty({
    example: 'customer@example.com',
    description: 'Email duy nhất (AC3, AC4)',
  })
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({
    example: '0987654321',
    description: 'Số điện thoại VN 10 số (AC4)',
  })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @Matches(/^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/, {
    message: 'Số điện thoại không đúng định dạng Việt Nam (10 số)',
  })
  phoneNumber: string;

  @ApiProperty({ example: 'Pass@1234', description: 'Mật khẩu mạnh (AC2)' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'Mật khẩu phải bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt',
    },
  )
  password: string;

  @ApiProperty({ example: 'Pass@1234', description: 'Nhập lại mật khẩu (AC2)' })
  @IsNotEmpty({ message: 'Xác nhận mật khẩu không được để trống' })
  @Match('password', { message: 'Mật khẩu nhập lại không khớp ' })
  confirmPassword: string;

  @ApiProperty({
    example: true,
    description: 'Đăng ký nhận bản tin quảng cáo (Tùy chọn)',
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Giá trị phải là kiểu đúng/sai' })
  isSubscribed?: boolean;

  @IsDateString({}, { message: 'Ngày sinh không đúng định dạng YYYY-MM-DD' })
  @IsOptional()
  dateOfBirth?: string;

  @IsString({ message: 'Giới tính phải là dạng chuỗi ký tự' })
  @IsOptional()
  gender?: string;
}
