import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class ReviewMediaDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsEnum(['IMAGE', 'VIDEO'])
  type: string;

  @IsString()
  @IsOptional()
  thumbnail?: string;
}

export class CreateReviewDto {
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @IsMongoId()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  variantSku: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ReviewMediaDto)
  media?: ReviewMediaDto[];
}

export class ReviewQueryParam {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['newest', 'oldest', 'highest_rating', 'lowest_rating'])
  sort?: string;

  @IsOptional()
  @IsNumberString()
  rating?: string;
}
