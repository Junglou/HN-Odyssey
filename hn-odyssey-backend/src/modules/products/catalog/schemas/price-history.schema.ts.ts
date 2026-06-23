import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PriceHistoryDocument = PriceHistory & Document;

@Schema({
  collection: 'price_histories',
  timestamps: { createdAt: true, updatedAt: false },
})
export class PriceHistory {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  product_id: Types.ObjectId;

  @Prop({ index: true })
  sku: string;

  @Prop({ required: true })
  old_price: number;

  @Prop({ required: true })
  new_price: number;

  @Prop({ default: 'USD' })
  currency: string;

  @Prop({ required: true })
  reason: string; // VD: 'Khuyến mãi tháng 10', 'Cập nhật giá gốc'

  @Prop({ type: Types.ObjectId, ref: 'User' })
  changed_by: Types.ObjectId; // Ai là người duyệt đổi giá

  @Prop()
  createdAt?: Date;
}

export const PriceHistorySchema = SchemaFactory.createForClass(PriceHistory);
