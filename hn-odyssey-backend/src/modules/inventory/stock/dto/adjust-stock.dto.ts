import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AdjustStockDto {
  @IsNotEmpty()
  @IsString()
  product_id: string;

  @IsNotEmpty()
  @IsString()
  sku: string; // [AC5] Bắt buộc có SKU để biết trừ biến thể nào

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number; // Số lượng khách mua

  @IsOptional()
  @IsString()
  reason?: string; // Ví dụ: "Đơn hàng #DH001"
}
