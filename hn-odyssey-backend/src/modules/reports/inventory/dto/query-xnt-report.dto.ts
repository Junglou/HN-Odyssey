import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dtos/pagination-query.dto';

export enum StockStatusFilter {
  ALL = 'ALL',
  NEGATIVE = 'NEGATIVE', // AC8: Tồn kho âm
  ZERO = 'ZERO', // AC8: Hết hàng
}

export class GetXntReportDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'start_date phải là định dạng ngày hợp lệ' })
  start_date?: string; // AC1

  @IsOptional()
  @IsDateString({}, { message: 'end_date phải là định dạng ngày hợp lệ' })
  end_date?: string; // AC1

  @IsOptional()
  @IsString()
  category_id?: string; // AC2: Lọc theo danh mục

  @IsOptional()
  @IsString()
  search?: string; // AC3 & AC9: Tìm theo SKU, Tên SP, Thuộc tính biến thể

  @IsOptional()
  @IsEnum(StockStatusFilter, {
    message: 'stock_status phải là ALL, NEGATIVE hoặc ZERO',
  })
  stock_status?: StockStatusFilter; // AC8
}

export class DrillDownQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
