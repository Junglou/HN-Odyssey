import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductStatus } from '../../../../common/enums/product-status.enum';
import { Type } from 'class-transformer';

//TRƯỜNG HỢP 1: Sửa thông tin chung (General Info)
// AC4: Loại bỏ Price và Status khỏi luồng update thông thường
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, [
    'price',
    'sale_price',
    'sale_start_date',
    'sale_end_date',
    // Status không được sửa ở đây, phải dùng API chuyển trạng thái riêng
  ] as const),
) {}

//TRƯỜNG HỢP 2: Cập nhật Trạng thái (Admin/Manager)
// Dùng cho API: PATCH /products/:id/status
export class UpdateProductStatusDto {
  @IsNotEmpty()
  @IsEnum(ProductStatus)
  status: ProductStatus;
}

class UpdateVariantPriceItem {
  @IsNotEmpty()
  @IsString()
  sku: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sale_price?: number;
}

//TRƯỜNG HỢP 3: Cập nhật Giá (Gửi yêu cầu duyệt)
// Dùng cho API: POST /products/:id/price-request (US.75)
export class UpdateProductPriceDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sale_price?: number;

  @IsOptional()
  @IsString()
  sale_start_date?: string;

  @IsOptional()
  @IsString()
  sale_end_date?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateVariantPriceItem)
  variants?: UpdateVariantPriceItem[];
}
