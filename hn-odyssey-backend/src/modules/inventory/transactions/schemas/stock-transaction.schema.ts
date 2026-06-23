import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StockTransactionDocument = StockTransaction & Document;

@Schema({ _id: false })
export class TransactionItem {
  // Không require từ FE nữa, BE sẽ tự điền dựa trên SKU
  @Prop({ type: Types.ObjectId, ref: 'Product' })
  product_id?: Types.ObjectId;

  @Prop({ required: true })
  sku: string;

  @Prop()
  product_name?: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop()
  note?: string;
}
export const TransactionItemSchema =
  SchemaFactory.createForClass(TransactionItem);

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class StockTransaction {
  @Prop({ required: true, unique: true, index: true })
  transaction_code: string;

  // GIỮ LẠI TOÀN BỘ ENUM CŨ ĐỂ KHÔNG LỖI TAB REQUEST QUEUE
  @Prop({
    required: true,
    enum: ['MANUAL_ADJUST', 'ORDER_ACCEPTED', 'RESTOCK', 'IMPORT', 'EXPORT'],
  })
  action_type: string;

  // CẬP NHẬT: Thêm PROCESSING cho phiếu nháp
  @Prop({
    required: true,
    enum: ['PROCESSING', 'COMPLETED', 'CANCELLED'],
    default: 'PROCESSING',
  })
  status: string;

  // CÁC TRƯỜNG MỚI BỔ SUNG (Nên để optional để các luồng cũ không bị lỗi văng DB)
  @Prop()
  warehouse?: string;

  @Prop()
  supplier?: string;

  @Prop()
  export_reason?: string;

  @Prop()
  cancel_reason?: string;

  // CÁC TRƯỜNG CŨ GIỮ NGUYÊN
  @Prop({ type: [TransactionItemSchema], required: true, default: [] })
  items: TransactionItem[];

  @Prop({ required: true, default: 0 })
  total_quantity: number;

  @Prop({ default: '' })
  note: string;

  @Prop()
  reference_code?: string; // Khôi phục lại mã tham chiếu

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actor_id: Types.ObjectId;

  created_at: Date;
  updated_at: Date;
}

export const StockTransactionSchema =
  SchemaFactory.createForClass(StockTransaction);
