import { IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';

export class ToggleWishlistDto {
  @IsNotEmpty({ message: 'Mã sản phẩm không được để trống' })
  @IsMongoId({ message: 'Mã sản phẩm không hợp lệ' })
  productId: string;

  @IsOptional()
  @IsMongoId({ message: 'Mã biến thể không hợp lệ' })
  variantId?: string;
}
