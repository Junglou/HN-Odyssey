import { IsArray, IsEnum, IsMongoId, ArrayNotEmpty } from 'class-validator';
import { BulkReviewAction } from 'src/common/enums/review.enum';

export class BulkActionDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Danh sách ID không được để trống' })
  @IsMongoId({ each: true, message: 'ID không hợp lệ' })
  review_ids: string[];

  @IsEnum(BulkReviewAction, { message: 'Hành động không hợp lệ' })
  action: BulkReviewAction;
}
