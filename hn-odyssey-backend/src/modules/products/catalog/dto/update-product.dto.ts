import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import {
  IsArray,
  IsDateString,
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

//TRƯỜNG HỢP 3: Cập nhật Giá (Gửi yêu cầu duyệt)
class UpdateVariantPriceItem {
  @IsNotEmpty() @IsString() sku: string;
  @IsNotEmpty()
  @IsNumber()
  @Min(1, { message: 'Giá phải lớn hơn 0' })
  price: number;
}

export class UpdateProductPriceDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1, { message: 'Giá bán phải là số dương (> 0)' }) // AC1 & AC7
  price: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNotEmpty({ message: 'Ngày áp dụng không được để trống' })
  @IsDateString()
  effective_date: string; // AC1: Ngày bắt đầu có hiệu lực

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateVariantPriceItem)
  variants?: UpdateVariantPriceItem[];
}
