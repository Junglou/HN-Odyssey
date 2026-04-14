import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum BehaviorAction {
  VIEW_PAGE = 'VIEW_PAGE',
  VIEW_PRODUCT = 'VIEW_PRODUCT',
  ADD_TO_CART = 'ADD_TO_CART',
  CLICK_ADD_TO_CART = 'CLICK_ADD_TO_CART',
  CLICK_IMAGE_ZOOM = 'CLICK_IMAGE_ZOOM',
  CLICK_READ_REVIEW = 'CLICK_READ_REVIEW',
  UPDATE_CART_QUANTITY = 'UPDATE_CART_QUANTITY',
  REMOVE_FROM_CART = 'REMOVE_FROM_CART',
  BEGIN_CHECKOUT = 'BEGIN_CHECKOUT',
  ADD_SHIPPING_INFO = 'ADD_SHIPPING_INFO',
  ADD_PAYMENT_INFO = 'ADD_PAYMENT_INFO',
  PURCHASE = 'PURCHASE',
  EXIT_PAGE = 'EXIT_PAGE',
}

export enum DeviceType {
  DESKTOP = 'DESKTOP',
  MOBILE = 'MOBILE',
  TABLET = 'TABLET',
}

// Định nghĩa chuẩn Interface thay cho any
export interface TrackingMetadata {
  product_id?: string;
  variant_id?: string;
  category_id?: string;
  order_id?: string;
  quantity?: number;
  price?: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  exit_page?: string;
  cart_snapshot?: Record<string, unknown>[];
  guest_email?: string; // Phục vụ lưu email khách vãng lai
}

@Schema({ collection: 'user_behaviors', timestamps: true })
export class UserBehavior extends Document {
  @Prop({ required: true, index: true })
  session_id: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true, sparse: true })
  user_id?: Types.ObjectId;

  @Prop({ enum: BehaviorAction, required: true, index: true })
  action: BehaviorAction;

  @Prop({ required: true })
  path: string;

  @Prop({ default: 'Direct' })
  source: string;

  @Prop({ enum: DeviceType, default: DeviceType.DESKTOP })
  device: DeviceType;

  // Thời gian dừng (AC2: Dwell Time Tracking)
  @Prop({ type: Number, default: 0 })
  dwell_time_seconds: number;

  @Prop({ type: Boolean, default: false })
  is_bounce: boolean;

  @Prop({ type: Object, default: {} })
  metadata: TrackingMetadata;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const UserBehaviorSchema = SchemaFactory.createForClass(UserBehavior);

// Index phục vụ Funnel & Merging Session
UserBehaviorSchema.index({ session_id: 1, action: 1 });
UserBehaviorSchema.index({ user_id: 1, action: 1 });

// AC7: TTL Index - Tự động xóa log hành vi quá 90 ngày (7776000 giây) để tiết kiệm DB
UserBehaviorSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
