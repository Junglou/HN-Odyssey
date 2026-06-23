import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ collection: 'recovery_requests', timestamps: true })
export class RecoveryRequest extends Document {
  // AC1: Tài khoản cũ bị mất (Email hoặc SĐT)
  @Prop({ required: true })
  target_account: string;

  // AC1: Email liên hệ mới (Quan trọng: Link reset sẽ gửi về đây)
  @Prop({ required: true })
  contact_email: string;

  // AC1: Lý do mất quyền truy cập
  @Prop({ required: true })
  reason: string;

  // AC2: Danh sách link ảnh giấy tờ (Sau khi upload lên Server/S3)
  @Prop({ type: [String], required: true })
  images: string[];

  // AC3: Trạng thái xử lý
  @Prop({
    required: true,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  })
  status: string;

  // AC5: Lý do từ chối (Nếu có)
  @Prop()
  rejection_reason?: string;

  // AC7: Người duyệt (Admin ID)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  processed_by?: MongooseSchema.Types.ObjectId;

  // AC7: Thời gian duyệt
  @Prop()
  processed_at?: Date;
}

export const RecoveryRequestSchema =
  SchemaFactory.createForClass(RecoveryRequest);
