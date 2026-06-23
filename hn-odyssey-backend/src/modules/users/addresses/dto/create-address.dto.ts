import {
  IsString,
  IsNotEmpty,
  Matches,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty({ message: 'Họ tên người nhận không được để trống' })
  name: string; // AC1

  @IsString()
  // AC3: Kiểm tra SĐT chuẩn 10 số nhà mạng VN
  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})$/, {
    message:
      'Số điện thoại không hợp lệ (Phải là 10 số và bắt đầu bằng đầu số VN)',
  })
  phone: string;

  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ chi tiết không được để trống' })
  street: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn Tỉnh/Thành phố' })
  city_code: string; // AC2: Cấp 1

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn Quận/Huyện' })
  district_code: string; // AC2: Cấp 2

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn Phường/Xã' })
  ward_code: string; // AC2: Cấp 3

  @IsOptional()
  @IsBoolean()
  is_default?: boolean; // AC4
}
