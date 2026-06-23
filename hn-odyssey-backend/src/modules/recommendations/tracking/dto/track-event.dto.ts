import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  Min,
} from 'class-validator';
// 1. Import các Enum (giá trị thực lúc runtime) bình thường
import { BehaviorAction, DeviceType } from '../schemas/user-behavior.schema';
// 2. Import Interface bằng 'import type' để fix lỗi Eslint / TS1272
import type { TrackingMetadata } from '../schemas/user-behavior.schema';

export class TrackEventDto {
  @IsString()
  session_id: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsEnum(BehaviorAction)
  action: BehaviorAction;

  @IsString()
  path: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsEnum(DeviceType)
  device: DeviceType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dwell_time_seconds?: number;

  @IsOptional()
  @IsObject()
  metadata?: TrackingMetadata;
}

export class MergeSessionDto {
  @IsString()
  session_id: string;

  @IsString()
  user_id: string;
}
