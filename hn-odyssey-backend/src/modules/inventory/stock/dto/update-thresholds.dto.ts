import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { IsLessThan } from 'src/common/decorators/is-less-than.decorator';

export class UpdateThresholdsDto {
  @IsNotEmpty()
  @IsString()
  product_id: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @IsLessThan('max_stock', {
    message: 'Tồn kho tối thiểu không được lớn hơn tồn kho tối đa',
  })
  min_stock: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  max_stock: number;
}
