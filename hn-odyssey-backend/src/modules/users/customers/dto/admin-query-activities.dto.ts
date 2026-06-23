import { IsOptional, IsDateString } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dtos/pagination-query.dto';

export class AdminQueryActivitiesDto extends PaginationQueryDto {
  @IsOptional() @IsDateString() from_date?: string;
  @IsOptional() @IsDateString() to_date?: string;
}
