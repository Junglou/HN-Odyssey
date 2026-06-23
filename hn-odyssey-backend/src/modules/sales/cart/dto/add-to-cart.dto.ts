import {
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty({ description: 'ID của sản phẩm', example: '645f...' })
  @IsMongoId({ message: 'Product ID không hợp lệ' })
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'SKU của biến thể (nếu có)', example: 'AO-DO-M' })
  @IsString()
  @IsNotEmpty()
  variantSku: string;

  @ApiProperty({ description: 'Số lượng mua', example: 1, minimum: 1 })
  @IsInt()
  @Min(1, { message: 'Số lượng phải lớn hơn 0' })
  quantity: number;

  @ApiProperty({
    description: 'Session ID cho khách vãng lai (Guest)',
    required: false,
  })
  @IsString()
  @IsOptional()
  guestSessionId?: string;
}
