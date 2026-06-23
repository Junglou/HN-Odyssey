import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Gender } from '../../schemas/user.schema';

export class AdminCreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  username: string;

  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email: string;

  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})$/, {
    message: 'Số điện thoại VN không hợp lệ',
  })
  phone: string;

  @IsString()
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Mật khẩu tạm thời phải bao gồm chữ hoa, chữ thường và số/ký tự đặc biệt',
  })
  tempPassword: string; // Bổ sung Mật khẩu tạm thời

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}
