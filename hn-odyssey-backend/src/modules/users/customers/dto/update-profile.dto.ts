import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  MinLength,
} from 'class-validator';
import { Gender } from '../../schemas/user.schema';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Tên (First Name) phải là chuỗi ký tự' })
  @MinLength(1, { message: 'Tên không được để trống' }) // AC2: Không bỏ trống
  first_Name?: string;

  @IsOptional()
  @IsString({ message: 'Họ (Last Name) phải là chuỗi ký tự' })
  @MinLength(1, { message: 'Họ không được để trống' }) // AC2
  last_Name?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'Giới tính không hợp lệ' })
  gender?: Gender;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'Ngày sinh phải đúng định dạng ISO (YYYY-MM-DD)' },
  )
  dateOfBirth?: string;
}
