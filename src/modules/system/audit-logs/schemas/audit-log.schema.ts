import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({
  collection: 'audit_logs',
  timestamps: { createdAt: true, updatedAt: false },
})
export class AuditLog extends Document {
  // 1. Thêm Index và Ref để sau này dùng .populate() nếu cần hiện tên User
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  actor_id?: Types.ObjectId;

  // 2. Index Action để lọc nhanh (VD: Lọc xem ai đang brute-force login)
  @Prop({ required: true, index: true })
  action: string;

  @Prop({ required: true })
  collection_name: string;

  // 3. ID của đối tượng bị tác động (Order ID, Product ID...)
  // Giúp query lịch sử của 1 sản phẩm cụ thể cực nhanh
  @Prop({ type: MongooseSchema.Types.ObjectId, index: true })
  target_id?: Types.ObjectId;

  @Prop({ type: Object })
  detail: any;

  // 4. Trạng thái hành động (Thành công/Thất bại)
  // Để phân biệt "Login thành công" vs "Login thất bại do sai pass"
  @Prop({ default: true })
  is_success: boolean;

  @Prop({ default: '' })
  error_reason?: string; // Lưu lý do lỗi nếu is_success = false

  @Prop()
  ip: string;

  @Prop()
  user_agent: string;
}

// 5. Tạo Compound Index hoặc TTL Index
const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Index tìm kiếm theo thời gian (Sort mới nhất)
AuditLogSchema.index({ createdAt: -1 });

// TTL Index: Tự động xóa log sau 30 ngày (2592000 giây) để nhẹ DB
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export { AuditLogSchema };
