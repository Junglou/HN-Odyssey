import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsInt,
  Min,
  Max,
  IsMongoId,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { PayoutMethod } from 'src/common/enums/trade-in.enum';

export class CreateTradeInRequestDto {
  @IsString()
  @IsNotEmpty()
  product_name: string;

  @IsMongoId()
  @IsNotEmpty()
  product_id: string;

  @IsMongoId()
  category_id: string;

  @IsInt()
  @Min(1)
  @Max(5)
  condition_score: number;

  @IsString()
  @IsOptional()
  condition_description?: string;

  @IsArray()
  @IsString({ each: true })
  media_urls: string[]; // Cần ít nhất 1 ảnh/video (AC1)
}

export class AcceptValuationDto {
  @IsEnum(PayoutMethod)
  payout_method: PayoutMethod;

  @IsOptional()
  payout_details?: Record<string, string>;
}

export class InspectItemDto {
  @IsInt()
  actual_condition_score: number;

  @IsInt()
  proposed_final_value: number;

  @IsString()
  inspection_note: string;
}
