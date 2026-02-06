import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ShippingItemDto {
  @ApiProperty({ example: '64b6a1f...' })
  @IsString()
  @IsNotEmpty()
  product_id: string;

  @ApiProperty({ example: 'SKU-123' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 0.5, required: false, description: 'Cân nặng (kg)' })
  @IsNumber()
  @IsOptional()
  weight?: number;
}

export class CalculateShippingFeeDto {
  @ApiProperty({ example: '79', description: 'Mã Tỉnh/Thành phố (HCM: 79)' })
  @IsString()
  @IsNotEmpty()
  cityCode: string;

  @ApiProperty({ example: '760', description: 'Mã Quận/Huyện (Q1: 760)' })
  @IsString()
  @IsNotEmpty()
  districtCode: string;

  @ApiProperty({ type: [ShippingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingItemDto)
  items: ShippingItemDto[];

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isInstant?: boolean;
}
