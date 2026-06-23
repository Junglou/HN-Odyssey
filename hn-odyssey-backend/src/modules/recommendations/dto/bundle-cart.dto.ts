import { IsString, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BundleItemDto {
  @IsString()
  product_id: string;

  @IsString()
  sku: string; // AC4: Bắt buộc truyền SKU của biến thể đã chọn

  @IsInt()
  @Min(1)
  quantity: number;
}

export class AddBundleToCartDto {
  @IsString()
  session_id: string;

  @IsString()
  base_product_id: string; // Sản phẩm chính đang xem

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleItemDto)
  items: BundleItemDto[]; // Danh sách sản phẩm phụ mua kèm
}
