import {
  IsString,
  MinLength,
  Matches,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';

// Tạo custom rule để so sánh 2 mật khẩu an toàn
@ValidatorConstraint({ name: 'matchPassword', async: false })
export class MatchPasswordConstraint implements ValidatorConstraintInterface {
  validate(confirmPassword: string, args: ValidationArguments) {
    // Ép kiểu an toàn về Record<string, unknown>
    const object = args.object as Record<string, unknown>;
    return confirmPassword === object['newPassword'];
  }
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu hiện tại' })
  currentPassword: string; // AC6

  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Mật khẩu mới phải bao gồm chữ hoa, chữ thường và số/ký tự đặc biệt', // AC8
  })
  newPassword: string; // AC6

  @IsString({ message: 'Xác nhận mật khẩu phải là chuỗi' })
  @Validate(MatchPasswordConstraint, {
    message: 'Xác nhận mật khẩu không trùng khớp với mật khẩu mới',
  })
  confirmPassword: string; // AC6
}
