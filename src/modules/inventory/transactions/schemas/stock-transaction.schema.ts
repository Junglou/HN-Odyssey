import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StockTransactionDocument = StockTransaction & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class StockTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product_id: Types.ObjectId;

  @Prop()
  sku: string;

  @Prop({
    required: true,
    enum: ['MANUAL_ADJUST', 'ORDER_ACCEPTED', 'RESTOCK', 'IMPORT'],
  })
  action_type: string;

  @Prop({ required: true })
  old_value: number;

  @Prop({ required: true })
  new_value: number;

  @Prop({ required: true })
  changed_value: number;

  @Prop({ required: true })
  reason: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  actor_id: Types.ObjectId; // ID người thực hiện thao tác
}

export const StockTransactionSchema =
  SchemaFactory.createForClass(StockTransaction);
