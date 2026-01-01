import { IsInt, IsMongoId, IsNotEmpty, IsString, Min } from 'class-validator';

export class UpdateCartItemDto {
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  variantSku: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class RemoveCartItemDto {
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  variantSku: string;
}
