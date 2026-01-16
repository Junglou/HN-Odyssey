import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ComboType {
  BUNDLE_FIXED_PRICE = 'BUNDLE_FIXED_PRICE', // Mua A+B giá 100k
  BUY_X_GET_Y = 'BUY_X_GET_Y', // Mua 2 giảm 10%
}

@Schema({ timestamps: true })
export class Combo extends Document {
  @Prop({ required: true })
  name: string; // Ví dụ: "Combo Mùa Hè"

  @Prop({ required: true, enum: ComboType })
  type: ComboType;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }] })
  product_ids: Types.ObjectId[]; // Danh sách SP áp dụng

  @Prop()
  min_quantity: number; // Mua tối thiểu bao nhiêu cái (AC10: Mua 2)

  @Prop()
  discount_value: number; // Giá trị giảm (10 hoặc 10000)

  @Prop({ default: false }) // false: giảm tiền, true: giảm %
  is_percent: boolean;

  @Prop({ default: true })
  active: boolean;

  @Prop()
  start_date: Date;

  @Prop()
  end_date: Date;
}

export const ComboSchema = SchemaFactory.createForClass(Combo);
