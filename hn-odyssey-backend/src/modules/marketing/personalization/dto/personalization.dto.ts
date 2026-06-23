import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum VoucherContext {
  HOME = 'HOME',
  PRODUCT = 'PRODUCT',
  CART = 'CART',
}

export class GetContextualVouchersDto {
  @IsEnum(VoucherContext, {
    message: 'Context phải là HOME, PRODUCT hoặc CART',
  })
  context: VoucherContext;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cart_total?: number;

  @IsOptional()
  @IsString()
  product_id?: string;

  // BỔ SUNG: ID của tỉnh/thành phố giao hàng
  @IsOptional()
  @IsString()
  delivery_province_id?: string;
}

export class GetDynamicBannersDto {
  @IsOptional()
  @IsString()
  session_id?: string;
}
