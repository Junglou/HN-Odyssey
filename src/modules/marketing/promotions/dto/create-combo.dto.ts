import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ComboType } from '../schemas/combo.schema';

export class CreateComboDto {
  @ApiProperty({ description: 'Tên chương trình khuyến mãi' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ComboType, example: ComboType.BUY_X_GET_Y })
  @IsEnum(ComboType)
  @IsNotEmpty()
  type: ComboType;

  @ApiProperty({ description: 'Danh sách ID sản phẩm áp dụng' })
  @IsMongoId({ each: true })
  @IsNotEmpty()
  product_ids: string[];

  @ApiProperty({ description: 'Số lượng mua tối thiểu', example: 2 })
  @IsNumber()
  @Min(1)
  min_quantity: number;

  @ApiProperty({ description: 'Giá trị giảm', example: 10 })
  @IsNumber()
  @Min(0)
  discount_value: number;

  @ApiProperty({ description: 'Giảm theo % hay tiền mặt', example: true })
  @IsBoolean()
  is_percent: boolean;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  start_date: Date;

  @ApiProperty({ example: '2030-12-31' })
  @IsDateString()
  end_date: Date;
}
