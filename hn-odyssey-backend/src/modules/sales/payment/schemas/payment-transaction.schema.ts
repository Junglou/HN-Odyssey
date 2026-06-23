import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentTransactionDocument = PaymentTransaction & Document;

@Schema({ timestamps: true, collection: 'payment_transactions' })
export class PaymentTransaction {
  @Prop({ required: true, index: true })
  order_code: string; // Mã đơn hàng

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  order_id: Types.ObjectId;

  @Prop({ required: true })
  provider: string; // VNPAY, MOMO

  @Prop({ required: true, enum: ['PAYMENT', 'REFUND'] })
  type: string; // Loại giao dịch

  @Prop({ required: true })
  amount: number;

  @Prop({ type: Object })
  request_data: any; // Dữ liệu gửi đi (URL, Body)

  @Prop({ type: Object })
  response_data: any; // Dữ liệu nhận về (IPN Raw Data)

  @Prop()
  transaction_code: string; // Mã giao dịch phía Ngân hàng (vnp_TransactionNo)

  @Prop({ required: true, enum: ['SUCCESS', 'FAILED', 'PENDING'] })
  status: string; // Kết quả xử lý

  @Prop()
  message: string; // Ghi chú lỗi nếu có
}

export const PaymentTransactionSchema =
  SchemaFactory.createForClass(PaymentTransaction);
