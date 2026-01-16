import {
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCartItemDto {
  @ApiProperty({ description: 'ID sản phẩm' })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'SKU hiện tại' })
  @IsString()
  @IsNotEmpty()
  variantSku: string;

  @ApiProperty({ description: 'Số lượng mới', minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  guestSessionId?: string;
}

export class RemoveCartItemDto {
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  variantSku: string;

  @IsString()
  @IsOptional()
  guestSessionId?: string;
}

//DTO cho AC5 (Đổi biến thể)
export class ChangeVariantDto {
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'SKU cũ muốn đổi' })
  @IsString()
  @IsNotEmpty()
  oldVariantSku: string;

  @ApiProperty({ description: 'SKU mới muốn chuyển sang' })
  @IsString()
  @IsNotEmpty()
  newVariantSku: string;

  @IsString()
  @IsOptional()
  guestSessionId?: string;
}
