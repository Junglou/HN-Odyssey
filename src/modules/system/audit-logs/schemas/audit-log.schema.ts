import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Department } from 'src/common/enums/department.enum';

export type AuditLogDocument = AuditLog & Document;

@Schema({
  collection: 'audit_logs',
  timestamps: { createdAt: true, updatedAt: false },
})
export class AuditLog {
  // 1. Thêm Index và Ref để sau này dùng .populate() nếu cần hiện tên User
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  actor_id?: Types.ObjectId;

  @Prop({ required: false, index: true })
  actor_employee_code?: string; // Vd: EMP001

  @Prop({ required: false })
  actor_email?: string;

  // 2. Index Action để lọc nhanh (VD: Lọc xem ai đang brute-force login)
  @Prop({ required: true, index: true })
  action: string;

  @Prop({ required: true })
  collection_name: string;

  // 3. ID của đối tượng bị tác động
  @Prop({ type: MongooseSchema.Types.ObjectId, index: true })
  target_id?: Types.ObjectId;

  @Prop({ type: Object })
  detail: any;

  // 4. Trạng thái hành động
  @Prop({ default: true })
  is_success: boolean;

  @Prop({ default: '' })
  error_reason?: string;

  @Prop()
  ip: string;

  @Prop()
  user_agent: string;

  @Prop({
    required: true,
    enum: Department, // Validate dữ liệu phải nằm trong Enum
    index: true, // Index cực quan trọng để View chạy nhanh
  })
  department: string;
}

const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Index tìm kiếm theo thời gian (Sort mới nhất)
AuditLogSchema.index({ createdAt: -1 });

// TTL Index: Tự động xóa log sau 30 ngày
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export { AuditLogSchema };
