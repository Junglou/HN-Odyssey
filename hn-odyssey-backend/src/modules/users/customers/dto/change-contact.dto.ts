import {
  IsString,
  IsEmail,
  IsEnum,
  MinLength,
  Matches,
  ValidateIf,
} from 'class-validator';

export enum ContactType {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
}

export class RequestChangeContactDto {
  @IsEnum(ContactType, { message: 'Loại liên hệ phải là EMAIL hoặc PHONE' })
  type: ContactType;

  @IsString({ message: 'Giá trị mới phải là chuỗi' })
  @ValidateIf((o: RequestChangeContactDto) => o.type === ContactType.EMAIL)
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @ValidateIf((o: RequestChangeContactDto) => o.type === ContactType.PHONE)
  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})$/, {
    message:
      'Số điện thoại không hợp lệ (Phải có 10 số và bắt đầu bằng đầu số VN hợp lệ)',
  })
  newValue: string; // AC4: Validate Regex ngay tại DTO

  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu hiện tại để xác thực' })
  currentPassword: string; // AC11: Bắt buộc xác thực lại
}

export class VerifyContactChangeDto {
  @IsString()
  @MinLength(6, { message: 'Mã xác thực không hợp lệ' })
  code: string;
}
