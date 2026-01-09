import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product' }) product_id: Types.ObjectId;
  @Prop() sku: string;
  @Prop() product_name: string;
  @Prop() price: number;
  @Prop() quantity: number;
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

  @Prop({ type: [OrderItem] })
  items: OrderItem[];

  @Prop({ type: Object })
  payment: { method: string; status: string; transaction_id?: string };

  @Prop()
  total_amount: number;

  @Prop({
    default: 'PENDING',
    enum: [
      'PENDING', // Chờ xử lý
      'PRIORITY', // Ưu tiên (AC2)
      'CONFIRMED', // Đang xử lý / Đã xác nhận
      'SHIPPING', // Đang vận chuyển
      'COMPLETED', // Đã giao hàng
      'CANCELLED', // Đã hủy
      'TEMPORARY', // Đơn tạm (Buy Now)
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
    city_code: string;
    email?: string;
    provider?: string;
    tracking_code?: string;
  };

  // Thêm Timeline (AC4 - Chi tiết đơn hàng)
  @Prop({ type: [SchemaFactory.createForClass(OrderTimeline)], default: [] })
  timeline: OrderTimeline[];

  // Thêm ghi chú nội bộ (AC8 - Chi tiết đơn hàng)
  @Prop()
  internal_note?: string;

  @Prop({ default: 0 })
  print_count: number; //AC8 (Bản chính/Bản sao)
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ 'shipping_info.phone': 1 });
OrderSchema.index({ status: 1, createdAt: -1 });
