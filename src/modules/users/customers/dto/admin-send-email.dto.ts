import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';

export class AdminSendEmailDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsBoolean()
  is_gift_included?: boolean; // Cờ quyết định có tặng mã hay không

  @IsOptional()
  @IsObject()
  coupon_config?: {
    discount_type: string;
    discount_value: number;
    min_order_value?: number;
    days_valid?: number;
  };
}
