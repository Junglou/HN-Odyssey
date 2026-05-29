import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import {
  EvaluationMethod,
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

@Schema({ _id: false })
class ShippingAddress {
  @Prop({ required: true }) street_address: string;
  @Prop() apt_suite?: string;
  @Prop({ required: true }) city: string;
  @Prop({ required: true }) state: string;
  @Prop({ required: true }) zip_code: string;
  @Prop({ required: true }) district_id: number;
  @Prop({ required: true }) ward_code: string;
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

  @Prop({ required: true })
  full_name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  phone_number: string;

  @Prop()
  product_name?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Category',
    required: true,
  })
  category_id: Types.ObjectId;

  @Prop({ required: true })
  condition_description: string;

  @Prop({ type: [String], required: true })
  media_urls: string[];

  @Prop({ required: true, enum: EvaluationMethod })
  evaluation_method: EvaluationMethod;

  @Prop({ type: ShippingAddress })
  shipping_address?: ShippingAddress;

  @Prop({ required: true })
  agreed_to_terms: boolean;

  @Prop({ default: 0 })
  estimated_value: number;

  @Prop({ default: 0 })
  final_value: number;

  @Prop({
    required: true,
    enum: TradeInStatus,
    default: TradeInStatus.PENDING,
    index: true,
  })
  status: TradeInStatus;

  @Prop()
  rma_order_code?: string;

  @Prop({ enum: PayoutMethod, default: PayoutMethod.VOUCHER })
  payout_method: PayoutMethod;

  @Prop({ type: Object })
  payout_details?: {
    voucher_code?: string;
    points_earned?: number;
    expiry_date?: string;
  };

  @Prop()
  device_storage?: string;

  @Prop({ default: [] })
  timeline: TimelineItem[];
}

export const TradeInRequestSchema =
  SchemaFactory.createForClass(TradeInRequest);

const TimelineItemSchema = SchemaFactory.createForClass(TimelineItem);
TradeInRequestSchema.path('timeline', [TimelineItemSchema]);
