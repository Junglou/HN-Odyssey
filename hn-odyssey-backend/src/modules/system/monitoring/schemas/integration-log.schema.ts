import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IntegrationLogDocument = IntegrationLog & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class IntegrationLog {
  @Prop({ required: true, index: true })
  provider: string; // GHN, GHTK, VNPAY, MOMO

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  duration_ms: number; // AC3: Giám sát độ trễ (Latency)

  @Prop({ required: true })
  status_code: number; // AC2: Giám sát tỷ lệ lỗi

  @Prop({ type: Object })
  request_data: Record<string, unknown>; // AC5: Nhật ký Request Body

  @Prop({ type: Object })
  response_data: Record<string, unknown>; // AC5: Nhật ký Response Body

  @Prop({ default: false })
  is_error: boolean;

  @Prop()
  createdAt: Date;
}

export const IntegrationLogSchema =
  SchemaFactory.createForClass(IntegrationLog);
IntegrationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // Xóa sau 30 ngày
