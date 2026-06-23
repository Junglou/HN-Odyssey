import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
class CartItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product_id: Types.ObjectId;

  @Prop({ required: true })
  sku: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ type: Date, default: Date.now })
  selected_at: Date;
}
const CartItemSchema = SchemaFactory.createForClass(CartItem);

@Schema({ timestamps: true })
export class Cart extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  user_id?: Types.ObjectId;

  @Prop({ index: true })
  session_id?: string;

  @Prop({ type: [CartItemSchema], default: [] })
  items: CartItem[];

  //Lưu mã giảm giá đang áp dụng tạm thời
  @Prop({ default: null })
  applied_coupon?: string;

  @Prop({ expires: '30d' })
  updatedAt: Date;
}

export const CartSchema = SchemaFactory.createForClass(Cart);
