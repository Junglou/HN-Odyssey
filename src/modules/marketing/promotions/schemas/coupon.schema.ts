import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

export enum CouponStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Coupon extends Document {
  // AC1 & AC2: Mã giảm giá (Code)
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, enum: DiscountType, type: String })
  discount_type: DiscountType;

  // AC3: Giá trị giảm
  @Prop({ required: true, min: 0 })
  discount_value: number;

  @Prop({ default: 0 })
  min_order_value: number;

  @Prop({ default: null })
  max_discount_amount?: number; // Hữu ích khi giảm %, VD: Giảm 10% tối đa 50k

  // AC4: Thời gian hiệu lực
  @Prop({ required: true })
  start_date: Date;

  @Prop({ required: true })
  end_date: Date;

  // AC5: Giới hạn sử dụng
  @Prop({ required: true, min: 1 })
  usage_limit: number; // Tổng số lần dùng

  @Prop({ default: 0 })
  usage_count: number; // Đã dùng bao nhiêu lần

  @Prop({ default: 1, min: 1 })
  user_usage_limit: number; // Mỗi user được dùng mấy lần

  @Prop({
    required: true,
    enum: CouponStatus,
    default: CouponStatus.DRAFT,
    type: String,
  })
  status: CouponStatus;

  // AC8: Soft Delete
  @Prop({ default: false, index: true })
  is_deleted: boolean;

  @Prop({ default: null })
  deleted_at: Date;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

// Index để tối ưu query khi user nhập mã thanh toán
CouponSchema.index({ code: 1, is_deleted: 1 });
CouponSchema.index({ status: 1, start_date: 1, end_date: 1 });
