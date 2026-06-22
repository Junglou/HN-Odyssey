import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
  ArrayMaxSize,
  IsEnum,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

class ReviewMediaUpdateDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsEnum(['IMAGE', 'VIDEO'])
  type: 'IMAGE' | 'VIDEO';

  @IsString()
  @IsOptional()
  thumbnail?: string;
}

export class UpdateReviewDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000, {
    message: 'Nội dung đánh giá không được vượt quá 1000 ký tự',
  })
  content?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ReviewMediaUpdateDto)
  @ArrayMaxSize(5, { message: 'Chỉ được phép tải lên tối đa 5 hình ảnh/video' })
  media?: ReviewMediaUpdateDto[];
}
