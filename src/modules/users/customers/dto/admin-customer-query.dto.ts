import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dtos/pagination-query.dto';
import { UserStatus } from 'src/common/enums/user-status.enum';

export class AdminCustomerQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string; // AC2: Tìm theo Tên, Email, SĐT

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus; // AC3: Lọc theo trạng thái

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt'; // AC4: Sắp xếp

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class UpdateCustomerStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;

  @IsString()
  reason: string; // AC4: Bắt buộc nhập lý do
}
