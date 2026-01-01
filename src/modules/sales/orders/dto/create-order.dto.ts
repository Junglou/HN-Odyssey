import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ShippingInfoDto {
  @IsNotEmpty() name: string;
  @IsNotEmpty() phone: string;
  @IsNotEmpty() address: string;
  @IsNotEmpty() city_code: string;
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
  note?: string;

  @IsOptional()
  @IsString()
  voucherCode?: string; 

  @IsOptional()
  @IsString()
  guestSessionId?: string;
}
