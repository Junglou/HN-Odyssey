import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
  Length,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';

class ReviewMediaDto {
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

export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  variantSku: string;

  // AC3: Rating từ 1 đến 5 sao
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  // AC3: Content từ 10 đến 1000 ký tự
  @IsString()
  @IsOptional()
  @MaxLength(1000, {
    message: 'Nội dung đánh giá không được vượt quá 1000 ký tự',
  })
  content?: string;

  // AC4: Tối đa 5 ảnh
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ReviewMediaDto)
  @ArrayMaxSize(5, { message: 'Chỉ được phép tải lên tối đa 5 hình ảnh/video' })
  media?: ReviewMediaDto[];

  // AC9: Chế độ ẩn danh
  @IsBoolean()
  @IsOptional()
  is_anonymous?: boolean;
}

// Thêm class này vào cuối file create-review.dto.ts
export class CreateCustomerReplyDto {
  @IsString()
  @IsNotEmpty({ message: 'Nội dung phản hồi không được để trống' })
  @Length(1, 1000)
  content: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ReviewMediaDto)
  @ArrayMaxSize(5)
  media?: ReviewMediaDto[];
}
