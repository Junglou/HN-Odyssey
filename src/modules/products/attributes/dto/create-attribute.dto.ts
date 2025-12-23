import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class CreateAttributeValueDto {
  @IsNotEmpty()
  @IsString()
  value: string; // "Đỏ"

  @IsOptional()
  @IsString()
  meta?: string; // "#FF0000" (Optional)
}

export class CreateAttributeDto {
  @IsNotEmpty({ message: 'Tên thuộc tính không được để trống' })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true }) // Validate từng phần tử object bên trong
  @Type(() => CreateAttributeValueDto) // Transform JSON sang Class
  @IsOptional()
  values?: CreateAttributeValueDto[];
}
