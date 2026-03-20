import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StockTransactionDocument = StockTransaction & Document;

// Định nghĩa sub-document cho từng dòng sản phẩm trong phiếu nhập (Đáp ứng AC4 - Đa dòng)
@Schema({ _id: false })
export class TransactionItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product_id: Types.ObjectId;

  @Prop({ required: true })
  sku: string; // Phải có SKU, nếu là sản phẩm cha thì lấy SKU cha, biến thể lấy SKU biến thể

  @Prop({ required: true, min: 1 })
  quantity: number; // AC3: Số lượng phải là số dương

  @Prop()
  note?: string; // Ghi chú riêng cho từng dòng (nếu cần)
}
export const TransactionItemSchema =
  SchemaFactory.createForClass(TransactionItem);

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class StockTransaction {
  // AC7: Mã phiếu nhập duy nhất (VD: IMP-20260319-XXXX)
  @Prop({ required: true, unique: true, index: true })
  transaction_code: string;

  @Prop({
    required: true,
    enum: ['MANUAL_ADJUST', 'ORDER_ACCEPTED', 'RESTOCK', 'IMPORT', 'EXPORT'],
  })
  action_type: string; // Với phiếu nhập hàng, ta dùng 'IMPORT'

  @Prop({
    required: true,
    enum: ['COMPLETED', 'CANCELLED'],
    default: 'COMPLETED',
  })
  status: string; // Bổ sung thêm trường status để quản lý trạng thái Hủy phiếu

  // Mảng chi tiết các sản phẩm được nhập (AC4)
  @Prop({ type: [TransactionItemSchema], required: true, default: [] })
  items: TransactionItem[];

  // Tổng số lượng của cả phiếu (Tiện cho việc query/thống kê)
  @Prop({ required: true, default: 0 })
  total_quantity: number;

  // AC6: Bắt buộc phải có Ghi chú hoặc Tham chiếu
  @Prop({ required: true })
  note: string;

  @Prop()
  reference_code?: string; // Mã tham chiếu (VD: Số hóa đơn từ nhà cung cấp)

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actor_id: Types.ObjectId; // AC5: Ghi nhận ID nhân viên thực hiện

  created_at: Date;
  updated_at: Date;

  // Đánh dấu đây là dữ liệu Read-only (AC4 - Lịch sử nhập hàng)
  // Thực tế MongoDB không có khoá cứng, ta sẽ dùng code Logic để block các hành vi Update/Delete
}

export const StockTransactionSchema =
  SchemaFactory.createForClass(StockTransaction);
