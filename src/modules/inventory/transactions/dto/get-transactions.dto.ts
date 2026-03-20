import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dtos/pagination-query.dto';

export class GetTransactionsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string; // Tìm theo Mã phiếu hoặc Tên nhân viên (AC3)

  @IsOptional()
  @IsEnum(['IMPORT', 'MANUAL_ADJUST', 'ORDER_ACCEPTED', 'RESTOCK'])
  action_type?: string; // Mặc định mình sẽ filter theo 'IMPORT' ở service

  @IsOptional()
  @IsString()
  start_date?: string; // (AC3) Lọc theo khoảng thời gian

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsEnum(['created_at', 'actor_id'])
  sort_by?: string; // (AC5) Sắp xếp

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sort_order?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  reason?: string; // Lọc theo lý do xuất kho
}
