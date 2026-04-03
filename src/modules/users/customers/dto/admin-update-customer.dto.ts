import { Type } from 'class-transformer';
import {
  IsString,
  Matches,
  IsEnum,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Gender } from '../../schemas/user.schema';

export class AddressDto {
  @IsString() name: string;
  @IsString() phone: string;
  @IsString() street: string;
  @IsString() city_code: string;
  @IsString() district_code: string;
  @IsString() ward_code: string;
  @IsOptional() @IsBoolean() is_default?: boolean;
}

export class AdminUpdateCustomerDto {
  @IsOptional() @IsString() first_Name?: string;
  @IsOptional() @IsString() last_Name?: string;

  @IsOptional()
  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone?: string;

  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsString() internal_note?: string;

  // FIX LỖI 1: Bổ sung cập nhật địa chỉ
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  addresses?: AddressDto[];
}
