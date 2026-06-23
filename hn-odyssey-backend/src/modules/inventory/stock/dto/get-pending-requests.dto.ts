import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dtos/pagination-query.dto';

export enum RequestFilterType {
  ALL = 'all',
  IMPORT = 'import',
  EXPORT = 'export',
}

export enum RequestFilterStatus {
  ALL = 'all',
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export class GetPendingRequestsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(RequestFilterType)
  type?: RequestFilterType;

  @IsOptional()
  @IsEnum(RequestFilterStatus)
  status?: RequestFilterStatus;

  @IsOptional()
  _t?: number | string;
}
