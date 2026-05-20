import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsArray,
} from 'class-validator';
import { ComboType, ComboStatus } from '../schemas/combo.schema';
import { ApplicableScope } from '../schemas/flash-sale.schema';

export class CreateComboDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ComboType)
  @IsNotEmpty()
  type: ComboType;

  @IsEnum(ApplicableScope)
  @IsNotEmpty()
  applicable_scope_type: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  applicable_scope_values: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  min_quantity?: number;

  @IsNumber()
  @Min(0)
  discount_value: number;

  @IsBoolean()
  is_percent: boolean;

  @IsOptional()
  @IsEnum(ComboStatus)
  status?: ComboStatus;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;
}
