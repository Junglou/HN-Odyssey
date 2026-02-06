import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

export class ShippingInfoDto {
  @IsNotEmpty()
  @MinLength(2, { message: 'Họ tên phải từ 2 ký tự trở lên' })
  name: string;
  @IsNotEmpty()
  @Matches(/(84|0[3|5|7|8|9])+([0-9]{8})\b/, {
    message: 'Số điện thoại không đúng định dạng Việt Nam',
  })
  phone: string;
  @IsNotEmpty() address: string;
  @IsNotEmpty() city_code: string;
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsNotEmpty({ message: 'Vui lòng chọn Quận/Huyện' })
  district_code: string;

  @IsOptional()
  ward_code?: string;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  source: 'CART' | 'BUY_NOW';

  @IsOptional()
  checkoutSessionToken?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ShippingInfoDto)
  shippingInfo: ShippingInfoDto;

  @IsString()
  paymentMethod: 'COD' | 'BANK_TRANSFER' | 'VNPAY';

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? sanitizeHtml(value) : (value as string),
  )
  note?: string;

  @IsOptional()
  @IsString()
  voucherCode?: string;

  @IsOptional()
  @IsString()
  guestSessionId?: string;

  @IsOptional()
  @IsBoolean()
  isInstant?: boolean;
}
