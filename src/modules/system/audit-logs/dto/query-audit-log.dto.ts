import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsDateString,
  IsBooleanString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAuditLogDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  collection_name?: string;

  @IsOptional()
  @IsString()
  actor_id?: string;

  // --- MỚI: Thêm 2 trường này để tìm kiếm tiện hơn ---
  @IsOptional()
  @IsString()
  actor_employee_code?: string; // Tìm theo mã NV (VD: EMP001)

  @IsOptional()
  @IsString()
  actor_email?: string; // Tìm theo email
  // --------------------------------------------------

  @IsOptional()
  @IsString()
  target_id?: string;

  @IsOptional()
  @IsDateString()
  from_date?: string;

  @IsOptional()
  @IsDateString()
  to_date?: string;

  @IsOptional()
  @IsBooleanString()
  is_success?: string;
}
