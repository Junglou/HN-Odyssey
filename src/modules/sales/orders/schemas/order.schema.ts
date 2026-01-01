import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product' }) product_id: Types.ObjectId;
  @Prop() sku: string;
  @Prop() product_name: string; 
  @Prop() price: number; 
  @Prop() quantity: number;
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
  shipping_info: any; 

  @Prop({ type: Object })
  payment: { method: string; status: string; transaction_id?: string };

  @Prop()
  total_amount: number;

  @Prop({
    default: 'PENDING',
    enum: [
      'PENDING',
      'CONFIRMED',
      'SHIPPING',
      'COMPLETED',
      'CANCELLED',
      'TEMPORARY',
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
}

export const OrderSchema = SchemaFactory.createForClass(Order);
