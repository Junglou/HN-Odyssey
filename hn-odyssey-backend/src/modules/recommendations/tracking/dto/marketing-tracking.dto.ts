import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

// US.82 AC1 — Ad Spend Ledger: thêm 1 dòng chi phí
export class CreateAdSpendEntryDto {
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: 'Số tiền phải là số, tối đa 2 chữ số thập phân.' },
  )
  @Min(0.01, { message: 'Số tiền phải lớn hơn 0.' })
  @Max(1_000_000_000, { message: 'Số tiền tối đa 1.000.000.000.' })
  amount: number;

  // "YYYY-MM-DD" — ngày theo lịch VN người dùng chọn
  @IsDateString({ strict: true }, { message: 'Ngày bắt đầu không hợp lệ.' })
  period_start: string;

  @IsDateString({ strict: true }, { message: 'Ngày kết thúc không hợp lệ.' })
  period_end: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự.' })
  note?: string;
}

// US.82 AC1 — hủy 1 dòng chi phí (bắt buộc lý do)
export class VoidAdSpendEntryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Lý do hủy không hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng nhập lý do hủy.' })
  @MaxLength(500, { message: 'Lý do hủy tối đa 500 ký tự.' })
  reason: string;
}

// Danh sách nhật ký: phân trang + kỳ lọc (để tính "chi phí trong kỳ")
export class AdSpendEntryQueryDto extends TrackingFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CouponFilterDto extends TrackingFilterDto {}
export class LoyaltyFilterDto extends TrackingFilterDto {}
