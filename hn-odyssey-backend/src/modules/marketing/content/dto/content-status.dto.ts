import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
} from 'class-validator';
import { BannerStatus } from '../schemas/banner.schema';
import { PageStatus } from '../schemas/static-page.schema';
import { PostStatus } from '../schemas/blog-post.schema';

// Banner: chỉ BẬT (ACTIVE) hoặc TẮT (HIDDEN); WAITING do hệ thống tự tính theo lịch
export class ChangeBannerStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  ids: string[];

  @IsIn([BannerStatus.ACTIVE, BannerStatus.HIDDEN], {
    message: 'Chỉ được bật (ACTIVE) hoặc tắt (HIDDEN) banner.',
  })
  status: BannerStatus;
}

export class ChangePageStatusDto {
  @IsEnum(PageStatus)
  status: PageStatus;
}

export class BulkPostIdsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  ids: string[];
}

// Gỡ xuất bản: về DRAFT hoặc HIDDEN (mặc định HIDDEN)
export class BulkUnpublishPostsDto extends BulkPostIdsDto {
  @IsOptional()
  @IsIn([PostStatus.DRAFT, PostStatus.HIDDEN])
  status?: PostStatus;
}
