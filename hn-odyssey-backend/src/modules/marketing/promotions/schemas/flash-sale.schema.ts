import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum FlashSaleStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  INACTIVE = 'INACTIVE',
}

export enum FlashSaleDiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_PRICE = 'FIXED_PRICE',
}

export enum ApplicableScope {
  PRODUCT = 'Product',
  CATEGORY = 'Category',
  TAG = 'Tag',
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class FlashSale extends Document {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true, enum: FlashSaleDiscountType })
  discount_type: FlashSaleDiscountType;

  @Prop({ required: true, min: 0 })
  discount_value: number;

  @Prop({ required: true })
  start_time: Date;

  @Prop({ required: true })
  end_time: Date;

  @Prop({
    required: true,
    enum: FlashSaleStatus,
    default: FlashSaleStatus.DRAFT,
  })
  status: FlashSaleStatus;

  // Hỗ trợ linh hoạt cho cả Product, Category, Tag từ FE
  @Prop({
    required: true,
    enum: ApplicableScope,
    default: ApplicableScope.PRODUCT,
  })
  applicable_scope_type: string;

  @Prop({ type: [String], required: true, default: [] })
  applicable_scope_values: string[];

  @Prop({ default: false })
  ai_personalization: boolean;
}

export const FlashSaleSchema = SchemaFactory.createForClass(FlashSale);
FlashSaleSchema.index({ status: 1, start_time: 1, end_time: 1 });
