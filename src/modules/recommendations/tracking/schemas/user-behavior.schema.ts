import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum BehaviorAction {
  VIEW_PAGE = 'VIEW_PAGE',
  VIEW_PRODUCT = 'VIEW_PRODUCT',
  ADD_TO_CART = 'ADD_TO_CART',
  BEGIN_CHECKOUT = 'BEGIN_CHECKOUT',
  ADD_SHIPPING_INFO = 'ADD_SHIPPING_INFO', // Giúp đo rớt khách khi nhập địa chỉ
  ADD_PAYMENT_INFO = 'ADD_PAYMENT_INFO', // Giúp đo rớt khách khi chọn thanh toán
  PURCHASE = 'PURCHASE',
}

export enum DeviceType {
  DESKTOP = 'DESKTOP',
  MOBILE = 'MOBILE',
  TABLET = 'TABLET',
}

@Schema({ timestamps: true })
export class UserBehavior extends Document {
  @Prop({ required: true, index: true })
  session_id: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true, sparse: true })
  user_id?: Types.ObjectId;

  @Prop({ enum: BehaviorAction, required: true, index: true })
  action: BehaviorAction;

  @Prop({ required: true })
  path: string; // URL khách đang xem

  @Prop({ default: 'Direct' })
  source: string; // Google, Facebook, Direct...

  @Prop({ enum: DeviceType, default: DeviceType.DESKTOP })
  device: DeviceType;

  @Prop({ type: Object })
  metadata?: {
    product_id?: string;
    category_id?: string;
    order_id?: string;
  };

  @Prop()
  createdAt?: Date;
}

export const UserBehaviorSchema = SchemaFactory.createForClass(UserBehavior);
// Compound index hỗ trợ Aggregation Phễu chuyển đổi cực nhanh
UserBehaviorSchema.index({ session_id: 1, action: 1 });
UserBehaviorSchema.index({ createdAt: -1 });
