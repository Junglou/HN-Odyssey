import { IsOptional, IsString, IsNumber, IsEnum, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export enum SortOption {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  BEST_SELLER = 'best_seller',
}

export class FilterProductDto {
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsEnum(SortOption)
  sort?: SortOption = SortOption.NEWEST;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  attributes?: Record<string, string>;
}
