import { IsNotEmpty, IsString } from 'class-validator';

export class MergeTagsDto {
  @IsNotEmpty()
  @IsString()
  targetTagId: string; // Thẻ giữ lại

  @IsNotEmpty()
  @IsString()
  sourceTagId: string; // Thẻ bị gộp (sẽ bị xóa)
}
