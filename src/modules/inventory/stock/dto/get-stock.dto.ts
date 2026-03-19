import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dtos/pagination-query.dto';

export class GetStockDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string; // Tên hoặc SKU (AC6)

  @IsOptional()
  @IsBoolean()
  out_of_stock?: boolean; // Lọc hết hàng (AC4)

  @IsOptional()
  @IsEnum(['stock', 'name'])
  sort_by?: string; // Sắp xếp theo (AC7)

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sort_order?: 'asc' | 'desc';
}
