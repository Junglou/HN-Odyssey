import {
  IsArray,
  IsMongoId,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class CompareProductsDto {
  @IsArray()
  @IsMongoId({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(4, { message: 'Chỉ được so sánh tối đa 4 sản phẩm (AC3)' })
  product_ids: string[];
}
