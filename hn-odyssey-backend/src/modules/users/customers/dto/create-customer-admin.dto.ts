import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateCustomerAdminDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})$/, {
    message: 'Số điện thoại VN không hợp lệ',
  })
  phone: string;
}
