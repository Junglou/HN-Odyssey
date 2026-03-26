import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export enum FlashSaleStatus {
  PENDING = 'PENDING', // Sắp diễn ra
  ACTIVE = 'ACTIVE', // Đang diễn ra
  EXPIRED = 'EXPIRED', // Đã kết thúc
  CANCELLED = 'CANCELLED', // Đã hủy
}

export enum FlashSaleDiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_PRICE = 'FIXED_PRICE', // Đồng giá
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
    default: FlashSaleStatus.PENDING,
  })
  status: FlashSaleStatus;

  // AC2: Gán danh sách sản phẩm
  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Product' }] })
  product_ids: Types.ObjectId[];

  // AC3: Cá nhân hóa AI
  @Prop({ default: false })
  ai_personalization: boolean;
}

export const FlashSaleSchema = SchemaFactory.createForClass(FlashSale);

// Tối ưu Query kiểm tra xung đột thời gian và lấy dữ liệu đang chạy
FlashSaleSchema.index({ status: 1, start_time: 1, end_time: 1 });
FlashSaleSchema.index({ product_ids: 1 });
