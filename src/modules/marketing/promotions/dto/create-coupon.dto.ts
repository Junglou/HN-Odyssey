import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsDateString,
  Matches,
} from 'class-validator';
import { DiscountType } from '../schemas/coupon.schema';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'Mã giảm giá chỉ được chứa chữ in hoa, số và dấu gạch dưới',
  })
  code: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(DiscountType)
  @IsNotEmpty()
  discount_type: DiscountType;

  @IsNumber()
  @Min(0)
  discount_value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_order_value?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_discount_amount?: number;

  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @IsInt()
  @Min(1)
  usage_limit: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  user_usage_limit?: number;
}
