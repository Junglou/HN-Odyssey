import { IsOptional, IsString } from 'class-validator';

export class ReviewQueryDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  star?: string;

  @IsOptional()
  @IsString()
  has_media?: string;

  @IsOptional()
  @IsString()
  sort_by?: string;

  @IsOptional()
  @IsString()
  variant_sku?: string;
}
