import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum PointTransactionType {
  EARN = 'EARN',
  REDEEM = 'REDEEM',
  EXPIRE = 'EXPIRE',
  REFUND = 'REFUND',
  BIRTHDAY = 'BIRTHDAY', // AC10: Quà sinh nhật
}

export enum PointStatus {
  PENDING = 'PENDING', // AC2: Vừa đặt hàng, chờ giao
  AVAILABLE = 'AVAILABLE', // AC2: Có thể sử dụng
  CANCELED = 'CANCELED', // AC2: Đơn hủy, điểm bị hủy
}

export type LoyaltyHistoryDocument = LoyaltyHistory & Document;

@Schema({ collection: 'loyalty_histories', timestamps: true })
export class LoyaltyHistory {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customer_id: Types.ObjectId;

  @Prop({ required: true, enum: PointTransactionType })
  type: PointTransactionType;

  @Prop({ required: true, enum: PointStatus, default: PointStatus.AVAILABLE })
  status: PointStatus;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  description: string;

  @Prop({ type: Types.ObjectId, default: null })
  order_id?: Types.ObjectId | null;

  // Thêm bên dưới dòng order_id
  @Prop({ default: 0 })
  base_order_amount?: number;

  @Prop({ type: Types.ObjectId, default: null })
  reward_item_id?: Types.ObjectId | null; // AC3: Tham chiếu quà hiện vật

  @Prop({ default: 0 })
  remaining_amount?: number;

  @Prop({ type: Date, default: null, index: true })
  expires_at?: Date | null;
}
export const LoyaltyHistorySchema =
  SchemaFactory.createForClass(LoyaltyHistory);
