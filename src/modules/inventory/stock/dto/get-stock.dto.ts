import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dtos/pagination-query.dto';

export enum StockFilterStatus {
  IN_STOCK = 'IN_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export class GetStockDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(StockFilterStatus)
  status?: StockFilterStatus | 'all';

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(['stock', 'name'])
  sort_by?: string;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sort_order?: 'asc' | 'desc';
}
