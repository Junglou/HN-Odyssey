import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SystemMetricDocument = SystemMetric & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class SystemMetric {
  @Prop({ required: true, index: true })
  path: string;

  @Prop({ required: true })
  method: string;

  @Prop({ required: true })
  duration_ms: number; // AC1: Lưu thời gian phản hồi

  @Prop({ required: true })
  status_code: number; // AC3: Thống kê tỷ lệ lỗi 5xx

  @Prop({ default: false, index: true })
  is_slow: boolean; // AC2: Đánh dấu Request chậm (>2000ms)

  @Prop()
  cpu_usage_percent: number; // AC4: Thông số CPU

  @Prop()
  ram_usage_percent: number; // AC4: Thông số RAM

  @Prop()
  createdAt: Date;
}

export const SystemMetricSchema = SchemaFactory.createForClass(SystemMetric);
// AC7: Tự động xoay vòng log (xóa sau 7 ngày = 604800 giây)
SystemMetricSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });
