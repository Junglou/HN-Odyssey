import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApplicableScope } from './flash-sale.schema';

export enum ComboType {
  BUNDLE_FIXED_PRICE = 'BUNDLE_FIXED_PRICE',
  BUY_X_GET_Y = 'BUY_X_GET_Y',
  DIRECT_DISCOUNT = 'DIRECT_DISCOUNT', // Thêm loại giảm giá trực tiếp
}

export enum ComboStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  INACTIVE = 'INACTIVE',
}

@Schema({ timestamps: true })
export class Combo extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true, enum: ComboType })
  type: ComboType;

  @Prop({
    required: true,
    enum: ApplicableScope,
    default: ApplicableScope.PRODUCT,
  })
  applicable_scope_type: string;

  @Prop({ type: [String], required: true, default: [] })
  applicable_scope_values: string[];

  @Prop({ default: 1 })
  min_quantity: number;

  @Prop({ required: true, min: 0 })
  discount_value: number;

  @Prop({ default: false })
  is_percent: boolean;

  @Prop({ required: true, enum: ComboStatus, default: ComboStatus.DRAFT })
  status: ComboStatus;

  @Prop()
  start_date: Date;

  @Prop()
  end_date: Date;
}

export const ComboSchema = SchemaFactory.createForClass(Combo);
