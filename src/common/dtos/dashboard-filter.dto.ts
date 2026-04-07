import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsMongoId,
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

// 1. Tự định nghĩa Enum SortOrder ở đây thay vì lấy từ mongoose
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
}

export class TopEntityFilterDto extends DashboardFilterDto {
  @IsOptional()
  @IsEnum(TimeFilter)
  time_filter?: TimeFilter = TimeFilter.THIS_MONTH;

  @IsOptional()
  @IsEnum(SortBy)
  sort_by?: SortBy = SortBy.REVENUE;

  // 2. Sử dụng Enum vừa tạo (Nên gán luôn mặc định là DESC để tránh undefined)
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder = SortOrder.DESC;

  @IsOptional()
  @IsMongoId({ message: 'category_id phải là một mã MongoDB ObjectId hợp lệ' })
  @IsString()
  category_id?: string;
}
