import {
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
  IsMongoId,
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

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
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
