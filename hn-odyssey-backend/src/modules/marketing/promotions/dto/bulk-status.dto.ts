import { ArrayNotEmpty, IsArray, IsIn, IsMongoId } from 'class-validator';

export class BulkPromotionStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  ids: string[];

  @IsIn(['ACTIVATE', 'DEACTIVATE'])
  action: 'ACTIVATE' | 'DEACTIVATE';
}
