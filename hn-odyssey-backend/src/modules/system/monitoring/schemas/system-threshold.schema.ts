import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SystemThresholdDocument = SystemThreshold & Document;

export const DEFAULT_THRESHOLDS = { cpu: 90, ram: 90, disk: 85 } as const;

// Chỉ có 1 bản ghi duy nhất (key = 'default') lưu ngưỡng cảnh báo của toàn hệ thống
@Schema({ timestamps: true, collection: 'system_thresholds' })
export class SystemThreshold {
  @Prop({ required: true, unique: true, default: 'default' })
  key: string;

  @Prop({ required: true, min: 1, max: 100, default: DEFAULT_THRESHOLDS.cpu })
  cpu: number;

  @Prop({ required: true, min: 1, max: 100, default: DEFAULT_THRESHOLDS.ram })
  ram: number;

  @Prop({ required: true, min: 1, max: 100, default: DEFAULT_THRESHOLDS.disk })
  disk: number;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updated_by: Types.ObjectId | null;
}

export const SystemThresholdSchema =
  SchemaFactory.createForClass(SystemThreshold);
