import { IsArray, IsMongoId, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CategoryOrderItem {
  @IsMongoId()
  id: string;

  @IsNumber()
  order: number;
}

export class UpdateCategoryOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryOrderItem)
  items: CategoryOrderItem[];
}
