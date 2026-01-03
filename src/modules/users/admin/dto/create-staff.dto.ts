import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  IsEnum,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../../common/enums/role.enum';

export class CreateStaffDto {
  @ApiProperty({
    description: 'Email (Dùng để đăng nhập)',
    example: 'admin.support@hnodyssey.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Họ (Last Name)', example: 'Trần' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: 'Tên (First Name)', example: 'Văn A' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Số điện thoại VN', example: '0987654321' })
  @IsString()
  @IsNotEmpty()
  @Matches(/(84|0[3|5|7|8|9])+([0-9]{8})\b/, {
    message: 'Số điện thoại không đúng định dạng Việt Nam.',
  })
  phone: string;

  @ApiProperty({
    description:
      'Mật khẩu bảo mật (AC2: Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số)',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số hoặc ký tự đặc biệt.',
  })
  password: string;

  @ApiProperty({
    description:
      'Vai trò của nhân viên trong hệ thống (ADMIN/STAFF/KHO). Phải là mảng.',
    example: ['SALES_STAFF', 'WAREHOUSE_MANAGER', Role.SUPER_ADMIN],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  roles: Role[];

  @IsNotEmpty()
  @IsString()
  department: string;
}
