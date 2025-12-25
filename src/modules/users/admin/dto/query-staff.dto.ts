import {
  IsOptional,
  IsString,
  IsNumberString,
  IsEnum,
} from 'class-validator';

export class QueryStaffDto {
  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  // Lưu ý: Query param thường gửi lên dạng string, cần transform ở Controller hoặc dùng BooleanString
  is_active?: boolean;

  @IsOptional()
  @IsString()
  sort_by?: string;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sort_direction?: 'asc' | 'desc';
}
