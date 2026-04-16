import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type TradeInPriceListDocument = TradeInPriceList & Document;

@Schema({ timestamps: true, collection: 'trade_in_price_lists' })
export class TradeInPriceList {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  })
  product_id: Types.ObjectId;

  // Điểm tình trạng do khách tự đánh giá (1 đến 5)
  @Prop({ required: true, min: 1, max: 5 })
  condition_score: number;

  // Giá thu mua cố định cấu hình sẵn cho mức tình trạng này
  @Prop({ required: true })
  fixed_price: number;

  @Prop({ default: true })
  is_active: boolean;
}

export const TradeInPriceListSchema =
  SchemaFactory.createForClass(TradeInPriceList);

// Tạo index kép (Compound Index) vì hệ thống sẽ luôn query theo Cặp (Product + Condition)
TradeInPriceListSchema.index(
  { product_id: 1, condition_score: 1 },
  { unique: true },
);
