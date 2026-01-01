import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

@Schema({ _id: false })
class CartItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product_id: Types.ObjectId;

  @Prop({ required: true })
  sku: string; // SKU biến thể

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ type: Date, default: Date.now })
  selected_at: Date;
}

const CartItemSchema = SchemaFactory.createForClass(CartItem);

@Schema({ timestamps: { createdAt: true, updatedAt: true } })
export class Cart extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  user_id?: Types.ObjectId;

  @Prop({ index: true })
  session_id?: string; // Dùng cho guest (lưu trong cookie/local storage)

  @Prop({ type: [CartItemSchema], default: [] })
  items: CartItem[];

  @Prop({ expires: '30d' })
  updatedAt: Date;
}

export const CartSchema = SchemaFactory.createForClass(Cart);
