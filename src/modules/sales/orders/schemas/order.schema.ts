import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product' })
  product_id: Types.ObjectId;
  @Prop()
  sku: string;
  @Prop({ required: true })
  product_name: string;
  @Prop()
  price: number;
  @Prop()
  quantity: number;
  @Prop()
  image: string;
}

@Schema()
class OrderTimeline {
  @Prop() status: string;
  @Prop() timestamp: Date;
  @Prop() actor: string;
  @Prop() note?: string;
}

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({ unique: true })
  order_code: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  user_id?: Types.ObjectId;

  @Prop({ type: Object })
  guest_info?: { name: string; phone: string; email?: string };

  @Prop({ default: false })
  isGuest: boolean;

  @Prop({ type: [OrderItem] })
  items: OrderItem[];

  @Prop({ type: Object })
  payment: { method: string; status: string; transaction_id?: string };

  @Prop()
  total_amount: number;

  @Prop({
    type: String,
    default: 'TEMPORARY',
    enum: [
      'TEMPORARY',
      'PENDING',
      'PRIORITY',
      'CONFIRMED',
      'PROCESSING',
      'ON_HOLD',
      'READY_TO_SHIP',
      'SHIPPING',
      'DELIVERED',
      'DELIVERY_FAILED',
      'COMPLETED',
      'CANCELLED',
      'RETURNED',
      'REFUND_PENDING',
      'REFUNDED',
      'REFUND_NEEDED',
      'TRADE_IN_REVIEW',
    ],
  })
  status: string;

  @Prop({ default: 0 })
  discount_amount: number;

  @Prop()
  voucher_code: string;

  @Prop()
  cancel_reason?: string;

  @Prop()
  hold_expires_at?: Date;

  @Prop({ index: true })
  session_id?: string;

  @Prop({ type: Object })
  shipping_info: {
    name: string;
    phone: string;
    address: string;
    district_code: string; // Thêm dòng này
    ward_code: string;
    city_code: string;
    email?: string;
    provider?: string;
    tracking_code?: string;
  };

  @Prop()
  waybill_code: string;

  @Prop()
  actual_shipping_fee: number;

  // Thêm Timeline (AC4 - Chi tiết đơn hàng)
  @Prop({ type: [SchemaFactory.createForClass(OrderTimeline)], default: [] })
  timeline: OrderTimeline[];

  // Thêm ghi chú nội bộ (AC8 - Chi tiết đơn hàng)
  @Prop()
  internal_note?: string;

  @Prop({ default: 0 })
  print_count: number; //AC8 (Bản chính/Bản sao)

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ 'shipping_info.phone': 1 });
OrderSchema.index({ status: 1, createdAt: -1 });
