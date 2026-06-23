import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderStatus {
  ALL = 'ALL',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DELIVERING = 'DELIVERING',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
}

export class GetMyOrdersDto {
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'Trạng thái đơn hàng không hợp lệ' })
  status?: OrderStatus = OrderStatus.ALL; // Mặc định là ALL (Tất cả)

  @IsOptional()
  @IsString()
  keyword?: string; // AC8: Dùng để tìm mã đơn hoặc tên sản phẩm

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1; // Mặc định trang 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10; // Mặc định 10 record/trang
}
