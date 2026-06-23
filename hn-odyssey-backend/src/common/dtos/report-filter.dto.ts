import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum TimeInterval {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

export class ReportFilterDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsEnum(TimeInterval)
  interval?: TimeInterval;

  @IsOptional()
  @IsString()
  campaign_id?: string; // Phục vụ AC8 Dashboard lọc theo chiến dịch

  @IsOptional()
  @IsString()
  product_id?: string; // Time-series AC4: Theo dõi 1 sản phẩm cụ thể
}
