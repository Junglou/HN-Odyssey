import { IsOptional, IsDateString, IsString } from 'class-validator';

export class TrackingFilterDto {
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  utm_source?: string;

  @IsOptional()
  @IsString()
  utm_medium?: string;
}

export class CouponFilterDto extends TrackingFilterDto {}
export class LoyaltyFilterDto extends TrackingFilterDto {}
