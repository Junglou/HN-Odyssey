import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';

class SeoConfigDto {
  @IsOptional()
  @IsString()
  meta_title?: string;

  @IsOptional()
  @IsString()
  meta_description?: string;
}

export class CreateCategoryDto {
  @IsNotEmpty({ message: 'Tên danh mục là bắt buộc' })
  @IsString()
  name: string;

  @IsOptional()
  @IsMongoId({ message: 'ID danh mục cha không hợp lệ' })
  parent_id?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  alt_text?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsNumber()
  display_order?: number;

  @IsOptional()
  @Type(() => SeoConfigDto)
  seo_config?: SeoConfigDto;
}
