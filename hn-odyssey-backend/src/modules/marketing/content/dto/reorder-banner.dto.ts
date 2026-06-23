import { IsArray, IsInt, IsMongoId, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BannerOrderItem {
  @IsMongoId()
  id: string;

  @IsInt()
  display_order: number;
}

export class ReorderBannersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BannerOrderItem)
  items: BannerOrderItem[];
}
