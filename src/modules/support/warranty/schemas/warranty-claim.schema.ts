import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export enum WarrantyStatus {
  ACTIVE = 'ACTIVE', // Xanh lá
  EXPIRING_SOON = 'EXPIRING_SOON', // Vàng (Dưới 30 ngày)
  EXPIRED = 'EXPIRED', // Xám
  VOIDED = 'VOIDED', // Đỏ (Từ chối)
}

export enum ClaimStatus {
  SUBMITTED = 'SUBMITTED', // Gửi yêu cầu
  RECEIVED = 'RECEIVED', // Đã tiếp nhận
  PROCESSING = 'PROCESSING', // Đang xử lý
  COMPLETED = 'COMPLETED', // Hoàn tất
}

// BẢNG 1: QUẢN LÝ SỔ BẢO HÀNH (Dựa trên Order)
@Schema({ timestamps: true, collection: 'warranty_items' })
export class WarrantyItem extends Document {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true,
  })
  order_id: Types.ObjectId;

  @Prop({ required: true }) order_code: string;
  @Prop({ required: true }) customer_phone: string; // Hỗ trợ tra cứu Guest AC2

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  product_id: Types.ObjectId;
  @Prop() product_name: string;

  @Prop({ required: true }) start_date: Date; // Kích hoạt khi giao hàng AC1
  @Prop({ required: true }) end_date: Date;

  @Prop({ enum: WarrantyStatus, default: WarrantyStatus.ACTIVE })
  status: WarrantyStatus;

  @Prop() void_reason: string; // Lý do từ chối AC3
}
export const WarrantyItemSchema = SchemaFactory.createForClass(WarrantyItem);

// BẢNG 2: YÊU CẦU ĐỔI TRẢ BẢO HÀNH (RMA)
@Schema({ _id: false })
class ClaimTimeline {
  @Prop({ enum: ClaimStatus, required: true }) status: ClaimStatus;
  @Prop({ default: Date.now }) timestamp: Date;
  @Prop() note: string; // Note cho AC8
}

@Schema({ timestamps: true, collection: 'warranty_claims' })
export class WarrantyClaim extends Document {
  @Prop({ unique: true }) claim_code: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'WarrantyItem',
    required: true,
  })
  warranty_item_id: Types.ObjectId;

  @Prop({ required: true }) reason: string;
  @Prop({ type: [String] }) images: string[]; // Ảnh lỗi

  @Prop({ enum: ClaimStatus, default: ClaimStatus.SUBMITTED })
  status: ClaimStatus;

  @Prop({ type: [SchemaFactory.createForClass(ClaimTimeline)], default: [] })
  timeline: ClaimTimeline[]; // Timeline 4 bước chuẩn AC6
}
export const WarrantyClaimSchema = SchemaFactory.createForClass(WarrantyClaim);
