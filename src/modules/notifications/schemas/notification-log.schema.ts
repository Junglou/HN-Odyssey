import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum NotificationType {
  ORDER = 'ORDER',
  STOCK = 'STOCK',
  SYSTEM = 'SYSTEM',
  SECURITY = 'SECURITY',
  LOYALTY = 'LOYALTY',
}

export enum NotificationPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

@Schema({ timestamps: true })
export class NotificationLog extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    index: true,
    default: null,
    sparse: true,
  })
  recipient_id: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ enum: NotificationType, required: true, index: true })
  type: NotificationType;

  @Prop({ enum: NotificationPriority, default: NotificationPriority.MEDIUM })
  priority: NotificationPriority;

  @Prop({ type: Object })
  metadata: {
    order_id?: string;
    sku?: string;
    target_url?: string; // AC4: Deeplink để điều hướng
    area_code?: string; // AC10: Phân tuyến kho/khu vực
    [key: string]: any;
  };

  @Prop({ default: false })
  is_read: boolean;

  @Prop({ type: Date })
  read_at: Date;

  @Prop({ type: String, index: true })
  recipient_role: string; // Lưu Role nhận (VD: SUPER_ADMIN)

  @Prop({ type: Types.ObjectId, ref: 'Warehouse', default: null })
  warehouse_id: Types.ObjectId; // Lưu ID kho (nếu có)
}

export const NotificationLogSchema =
  SchemaFactory.createForClass(NotificationLog);
NotificationLogSchema.index({ createdAt: -1 });
