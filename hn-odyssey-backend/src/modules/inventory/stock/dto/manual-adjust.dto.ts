import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ManualAdjustDto {
  @IsNotEmpty()
  @IsString()
  product_id: string;

  @IsNotEmpty()
  @IsString()
  sku: string; // Biến thể cụ thể (AC6)

  @IsNotEmpty()
  @IsNumber()
  adjustment_value: number; // Số lượng tăng/giảm (AC1, AC2)

  @IsNotEmpty()
  @IsString()
  reason: string; // Bắt buộc nhập lý do (AC3)
}
