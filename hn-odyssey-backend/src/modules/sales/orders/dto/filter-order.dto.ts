import {
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
  IsMongoId,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterOrderDto {
  @IsOptional() @IsMongoId() user_id?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  // Khai báo rõ kiểu dữ liệu (o: FilterOrderDto) để qua mặt ESLint strict mode
  @IsOptional()
  @ValidateIf((o: FilterOrderDto) => o.fromDate !== '')
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @ValidateIf((o: FilterOrderDto) => o.toDate !== '')
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string))
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
