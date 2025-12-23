import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsDateString,
  IsBooleanString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAuditLogDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  action?: string; // Lọc theo hành động (VD: LOGIN)

  @IsOptional()
  @IsString()
  collection_name?: string; // Lọc theo bảng (VD: users)

  @IsOptional()
  @IsString()
  actor_id?: string; // Lọc xem nhân viên A đã làm gì

  @IsOptional()
  @IsString()
  target_id?: string; // Lọc lịch sử của 1 đơn hàng cụ thể

  @IsOptional()
  @IsDateString()
  from_date?: string; // Từ ngày

  @IsOptional()
  @IsDateString()
  to_date?: string; // Đến ngày

  @IsOptional()
  @IsBooleanString()
  is_success?: string; // Lọc log lỗi hay thành công
}
