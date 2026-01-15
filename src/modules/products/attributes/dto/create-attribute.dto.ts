import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  ValidateNested,
  IsEnum,
  Matches,
  MaxLength,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { AttributeType } from 'src/common/enums/attribute-type.enum';

export class CreateAttributeValueDto {
  @IsNotEmpty()
  @IsString()
  label: string; // "Đỏ"

  @IsNotEmpty()
  @IsString()
  value: string; // "red"

  @IsOptional()
  @IsString()
  meta?: string; // "#FF0000"
}

export class CreateAttributeDto {
  @IsNotEmpty({ message: 'Tên thuộc tính không được để trống' })
  @MaxLength(255)
  name: string;

  //AC11: Validate Code (Chỉ chữ, số, gạch dưới)
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Mã code chỉ được chứa chữ cái, số, gạch dưới và gạch ngang',
  })
  code: string;

  //AC2: Validate Enum
  @IsNotEmpty()
  @IsEnum(AttributeType, { message: 'Kiểu hiển thị không hợp lệ' })
  display_type: AttributeType;

  @IsOptional()
  @IsString()
  description?: string;

  // Validate danh sách giá trị con
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAttributeValueDto)
  @IsOptional()
  values?: CreateAttributeValueDto[];

  @IsArray()
  @IsOptional()
  applicable_categories?: string[];

  @IsBoolean()
  @IsOptional()
  is_filterable?: boolean;

  @IsNumber()
  @IsOptional()
  sort_order?: number;
}
