import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsNumber,
  IsMongoId,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetFBTDto {
  @IsString()
  product_id: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 3; // AC15: Giới hạn tối đa 3-5
}

export class GetCartRecommendationsDto {
  @IsString()
  session_id: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsNumber()
  @Min(0)
  current_cart_total: number; // Để tính Freeship Gap (AC2)

  @IsOptional()
  @IsString()
  exclude_ids?: string;
}

export class GetPersonalizedDto {
  @IsString()
  session_id: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : undefined,
  ) // Tự động cắt khoảng trắng 2 đầu
  @IsMongoId({ message: 'user_id phải là một MongoDB ObjectId hợp lệ' }) // Chặn đứng ngay từ cửa
  user_id?: string;

  @IsOptional()
  @IsString()
  current_category_slug?: string; // Phục vụ Gợi ý trong trang danh mục (AC2)
}
