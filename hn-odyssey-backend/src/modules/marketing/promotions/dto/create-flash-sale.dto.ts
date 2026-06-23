import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsArray,
} from 'class-validator';
import {
  FlashSaleDiscountType,
  FlashSaleStatus,
  ApplicableScope,
} from '../schemas/flash-sale.schema';

export class CreateFlashSaleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(FlashSaleDiscountType)
  @IsNotEmpty()
  discount_type: FlashSaleDiscountType;

  @IsNumber()
  @Min(0)
  discount_value: number;

  @IsDateString()
  @IsNotEmpty()
  start_time: string;

  @IsDateString()
  @IsNotEmpty()
  end_time: string;

  @IsOptional()
  @IsEnum(FlashSaleStatus)
  status?: FlashSaleStatus;

  @IsEnum(ApplicableScope)
  @IsNotEmpty()
  applicable_scope_type: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  applicable_scope_values: string[];

  @IsOptional()
  @IsBoolean()
  ai_personalization?: boolean;
}
