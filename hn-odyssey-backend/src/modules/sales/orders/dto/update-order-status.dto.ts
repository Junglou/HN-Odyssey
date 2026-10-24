import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsNotEmpty()
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  is_override?: boolean;

  @IsOptional()
  @IsString()
  shipping_provider?: string;

  @IsOptional()
  @IsString()
  tracking_code?: string;

  @IsOptional()
  @IsString()
  note?: string;

  // Trạng thái (gốc của BE) mà người thao tác đang thấy trên màn hình.
  // Khác với DB → 409: đơn đã được người khác cập nhật.
  @IsOptional()
  @IsString()
  expected_status?: string;
}
