import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PostStatus } from '../schemas/blog-post.schema';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang',
  })
  slug: string;

  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  thumbnail: string;

  @IsOptional()
  @IsMongoId()
  category_id?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // US.125 - AC8: Danh sách ID Sản phẩm để hiển thị Widget
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  embedded_product_ids?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  meta_title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  meta_description?: string;

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  // US.125 - AC4: Ngày giờ hẹn đăng bài
  @IsOptional()
  @IsDateString()
  published_at?: string;
}
