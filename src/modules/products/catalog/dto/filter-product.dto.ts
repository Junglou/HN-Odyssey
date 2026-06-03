import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  Min,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum SortOption {
  TRENDING = 'trending',
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
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  keyword?: string;

  // CHÌA KHÓA NẰM Ở ĐÂY: Giải mã JSON.stringify từ Frontend
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, string>;
      } catch {
        return undefined; // bỏ qua lỗi phân tích cú pháp
      }
    }

    if (typeof value === 'object' && value !== null) {
      return value as Record<string, string>;
    }

    return undefined;
  })
  @IsObject() // khai báo định dạng object để biến không bị loại bỏ
  attributes?: Record<string, string>;
}
