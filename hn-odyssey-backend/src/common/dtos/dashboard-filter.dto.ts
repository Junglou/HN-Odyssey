import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  Min,
  IsNumber,
} from 'class-validator';

export enum TimeFilter {
  TODAY = 'TODAY',
  THIS_WEEK = 'THIS_WEEK',
  THIS_MONTH = 'THIS_MONTH',
  THIS_YEAR = 'THIS_YEAR',
  CUSTOM = 'CUSTOM',
}

export enum SortBy {
  REVENUE = 'REVENUE',
  QUANTITY = 'QUANTITY',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class DashboardFilterDto {
  @IsOptional()
  @IsEnum(TimeFilter)
  time_filter?: TimeFilter = TimeFilter.TODAY;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  target_kpi?: number = 2.5;

  @IsOptional()
  @IsString()
  category_id?: string;
}

export class TopEntityFilterDto extends DashboardFilterDto {
  // Ghi đè default value của class cha
  @IsOptional()
  @IsEnum(TimeFilter)
  declare time_filter?: TimeFilter;

  @IsOptional()
  @IsEnum(SortBy)
  sort_by?: SortBy = SortBy.REVENUE;

  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder = SortOrder.DESC;
}
