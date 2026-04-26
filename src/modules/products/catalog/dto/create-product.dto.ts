import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// 1. DTO cho kích thước (US.78)
class ProductDimensionsDto {
  @IsOptional() @IsNumber() @Min(0) length?: number;
  @IsOptional() @IsNumber() @Min(0) width?: number;
  @IsOptional() @IsNumber() @Min(0) height?: number;
  @IsOptional() @IsString() unit?: string; // cm, m
}

// 2. DTO cho SEO
class SeoConfigDto {
  @IsOptional() @IsString() meta_title?: string;
  @IsOptional() @IsString() meta_description?: string;
  @IsOptional() @IsString() meta_keywords?: string;
}

// 3.DTO cho thuộc tính biến thể (US.74)
export class VariantAttributeDto {
  @IsNotEmpty()
  @IsString()
  code: string; // VD: "color"

  @IsNotEmpty()
  @IsString()
  value: string; // VD: "red"

  @IsOptional()
  @IsString()
  unit?: string;
}

// 4. DTO tạo Biến thể
export class CreateProductVariantDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'SKU biến thể không hợp lệ' })
  sku: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantAttributeDto)
  attributes: VariantAttributeDto[];

  @IsOptional() @IsNumber() @Min(0) price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sale_price?: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  stock: number; // Tồn kho riêng từng biến thể

  @IsOptional() @IsString() image?: string; // URL ảnh riêng
  @IsOptional() @IsNumber() image_index?: number; // Index ảnh trong mảng images cha

  @IsOptional() @IsBoolean() active?: boolean;
}

// 5. DTO chính - Tạo Sản phẩm
export class CreateProductDto {
  // US.72 AC1: Thông tin cơ bản
  @IsNotEmpty({ message: 'Tên sản phẩm là bắt buộc' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Mã SKU là bắt buộc' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Mã SKU chỉ được chứa chữ cái không dấu, số, gạch ngang (-) hoặc gạch dưới (_)',
  })
  sku: string;

  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() short_description?: string;
  @IsOptional() @IsString() brand?: string;

  // US.72 AC1: Danh mục & Tags
  @IsNotEmpty({ message: 'Sản phẩm phải thuộc ít nhất 1 danh mục' })
  @IsArray()
  @IsMongoId({ each: true, message: 'ID danh mục không hợp lệ' })
  category_ids: string[];

  // [FIX 1]: BẮT BUỘC PHẢI CÓ TAGS CHO AI
  @IsArray({ message: 'Tags phải là một mảng' })
  @ArrayMinSize(1, {
    message:
      'Sản phẩm phải có ít nhất 1 Tag (VD: Outdoor, Lều) để AI phân tích',
  })
  @IsString({ each: true })
  tags: string[];

  // [FIX 2]: BỔ SUNG TRƯỜNG DÀNH CHO AI & THUẬT TOÁN GỢI Ý
  @IsOptional()
  @IsBoolean()
  is_flash_sale?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5) // Thang điểm lợi nhuận từ 1 đến 5
  margin_tier?: number;

  // US.73: Media
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @IsOptional() @IsString() thumbnail?: string;
  @IsOptional() @IsString() video?: string;

  // US.75: Giá & Khuyến mãi (Giá chung cho SP đơn giản)
  @IsOptional() @IsNumber() @Min(0) price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sale_price?: number;

  @IsOptional()
  @IsDateString()
  sale_start_date?: string;

  @IsOptional()
  @IsDateString()
  sale_end_date?: string;

  // US.74: Biến thể
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];

  // US.78: Tồn kho & Cấu hình
  @IsNumber({}, { message: 'Cân nặng phải là số (kg)' })
  @Min(0.01, { message: 'Cân nặng tối thiểu là 0.01kg (10g)' })
  @Max(50, { message: 'Cân nặng không được vượt quá 50kg' })
  weight: number;

  @IsOptional() @IsNumber() @Min(0) stock?: number; // Tổng tồn kho (nếu là sp đơn giản)
  @IsOptional() @IsNumber() @Min(0) min_stock?: number;
  @IsOptional() @IsNumber() @Min(0) max_stock?: number;

  @IsOptional()
  @IsBoolean()
  allow_backorder?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDimensionsDto)
  dimensions?: ProductDimensionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SeoConfigDto)
  seo_config?: SeoConfigDto;
}
