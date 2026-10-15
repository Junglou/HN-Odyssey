import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Một món trong giỏ được chọn để thanh toán (dùng cho "Mua ngay")
export class SelectedCartItemDto {
  @IsMongoId()
  productId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sku: string;
}

// Gói sẵn decorator để các DTO khác không phải import thêm từ class-validator
export const IsOptionalSelectedItems = () =>
  applyDecorators(
    IsOptional(),
    IsArray(),
    ArrayMaxSize(50),
    ValidateNested({ each: true }),
    Type(() => SelectedCartItemDto),
  );
