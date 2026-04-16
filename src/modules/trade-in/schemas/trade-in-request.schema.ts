import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import {
  PayoutMethod,
  TradeInStatus,
  TradeInTimelineEvent,
} from 'src/common/enums/trade-in.enum';

export type TradeInRequestDocument = TradeInRequest & Document;

@Schema({ _id: false })
class TimelineItem implements TradeInTimelineEvent {
  @Prop({ required: true, enum: TradeInStatus })
  status: TradeInStatus;

  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  actor_id?: string;

  @Prop()
  note?: string;
}

@Schema({ timestamps: true, collection: 'trade_in_requests' })
export class TradeInRequest {
  @Prop({ unique: true, required: true })
  request_code: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true,
  })
  customer_id: Types.ObjectId;

  // AC1 & AC3: Thông tin sản phẩm và Danh mục
  @Prop({ required: true })
  product_name: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Category',
    required: true,
  })
  category_id: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  condition_score: number;

  @Prop()
  condition_description: string;

  @Prop({ type: [String], required: true }) // AC1: Ít nhất 1 ảnh/video
  media_urls: string[];

  // AC2: Định giá
  @Prop({ default: 0 })
  estimated_value: number;

  @Prop({ default: 0 })
  final_value: number;

  @Prop({
    required: true,
    enum: TradeInStatus,
    default: TradeInStatus.PENDING_VALUATION,
    index: true,
  })
  status: TradeInStatus;

  // AC4: Reverse Logistics
  @Prop()
  rma_order_code?: string;

  // AC6: Thanh toán
  @Prop({ enum: PayoutMethod, default: PayoutMethod.VOUCHER })
  payout_method: PayoutMethod;

  @Prop({ type: Object })
  payout_details?: {
    bank_name?: string;
    account_number?: string;
    account_name?: string;
    voucher_code?: string;
  };

  // AC7: Tracking Timeline
  @Prop({ type: [SchemaFactory.createForClass(TimelineItem)], default: [] })
  timeline: TimelineItem[];
}

export const TradeInRequestSchema =
  SchemaFactory.createForClass(TradeInRequest);
