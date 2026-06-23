import { PartialType } from '@nestjs/swagger';
import { CreateBannerDto } from './create-banner.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { BannerStatus } from '../schemas/banner.schema';

export class UpdateBannerDto extends PartialType(CreateBannerDto) {
  @IsOptional()
  @IsEnum(BannerStatus)
  status?: BannerStatus;
}
