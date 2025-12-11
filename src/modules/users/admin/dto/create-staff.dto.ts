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

  @ApiProperty({ description: 'Mã nhân viên (UNIQUE)', example: 'S001' })
  @IsString()
  @IsNotEmpty()
  employeeCode: string;

  @ApiProperty({ description: 'Họ và tên đầy đủ', example: 'Trần Văn A' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

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
    example: [Role.STAFF, Role.ADMIN],
  })
  @IsArray()
  @IsEnum(Role, { each: true, message: 'Vai trò không hợp lệ.' })
  @IsNotEmpty()
  roles: Role[];
}
