import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { FlashSaleDiscountType } from '../schemas/flash-sale.schema';

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

  @IsMongoId({ each: true })
  @IsNotEmpty()
  product_ids: string[];

  @IsOptional()
  @IsBoolean()
  ai_personalization?: boolean;
}
