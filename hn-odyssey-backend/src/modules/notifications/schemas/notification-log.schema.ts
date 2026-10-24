import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum NotificationType {
  ORDER = 'ORDER',
  STOCK = 'STOCK',
  SYSTEM = 'SYSTEM',
  SECURITY = 'SECURITY',
  SUPPORT = 'SUPPORT',
  REVIEW = 'REVIEW',
  LOYALTY = 'LOYALTY',
  PROMOTION = 'PROMOTION',
}

export enum NotificationPriority {
  CRITICAL = 'CRITICAL', // Tiền / bảo mật / hệ thống bị ảnh hưởng — xử lý ngay
  HIGH = 'HIGH', // Việc nghiệp vụ cần làm trong ngày
  MEDIUM = 'MEDIUM', // Cần biết, xử lý khi tiện
  LOW = 'LOW', // Thông tin, kết quả
}

// Dùng để so sánh khi một cảnh báo đang mở bị "leo thang" mức độ
export const PRIORITY_RANK: Record<NotificationPriority, number> = {
  [NotificationPriority.CRITICAL]: 4,
  [NotificationPriority.HIGH]: 3,
  [NotificationPriority.MEDIUM]: 2,
  [NotificationPriority.LOW]: 1,
};

// Chuông chỉ hiển thị và đếm thông báo trong N ngày gần nhất (dữ liệu vẫn còn trong DB)
export const NOTIFICATION_VISIBLE_DAYS = 30;
// Sau N ngày kể từ lần xảy ra gần nhất, MongoDB tự xóa vật lý (TTL index cuối file)
export const NOTIFICATION_RETENTION_DAYS = 90;

// PORTAL: thông báo cho nhân sự (hiện trong chuông Portal)
// CUSTOMER: thông báo cho khách hàng (không bao giờ hiện trong Portal)
export enum NotificationScope {
  PORTAL = 'PORTAL',
  CUSTOMER = 'CUSTOMER',
}

export enum NotificationStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

@Schema({ timestamps: true })
export class NotificationLog extends Document {
  @Prop({
    type: String,
    enum: NotificationScope,
    default: NotificationScope.PORTAL,
    index: true,
  })
  scope: NotificationScope;

  // Mã sự kiện trong NOTIFICATION_POLICIES (null với thông báo cá nhân)
  @Prop({ type: String, default: null })
  event_code: string | null;

  // Người nhận đích danh. null = gửi theo quyền (target_resource + required_action)
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  recipient_id: Types.ObjectId | null;

  // Gửi theo quyền: ai có required_action trên target_resource thì nhận
  @Prop({ type: String, default: null })
  target_resource: string | null;

  @Prop({ type: String, default: null })
  required_action: string | null;

  // Cấp role tối thiểu (RoleLevel: 1 = BOARD cao nhất). null = mọi cấp đều nhận
  @Prop({ type: Number, default: null })
  min_level: number | null;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: String, enum: NotificationType, required: true, index: true })
  type: NotificationType;

  @Prop({
    type: String,
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority;

  @Prop({ type: Object, default: {} })
  metadata: {
    target_url?: string; // Deeplink điều hướng
    [key: string]: unknown;
  };

  // Trạng thái đã đọc RIÊNG từng người (không còn 1 cờ is_read chung cho cả role)
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  read_by: Types.ObjectId[];

  // OPEN: còn hiệu lực. RESOLVED: sự cố đã được xử lý (tự động hoặc thủ công)
  @Prop({
    type: String,
    enum: NotificationStatus,
    default: NotificationStatus.OPEN,
    index: true,
  })
  status: NotificationStatus;

  @Prop({ type: Date, default: null })
  resolved_at: Date | null;

  // Khóa chống trùng: cùng khóa + đang OPEN + trong cửa sổ thời gian => gộp, không tạo mới
  @Prop({ type: String, default: null, index: true })
  dedupe_key: string | null;

  // Số lần sự kiện lặp lại đã được gộp vào thông báo này
  @Prop({ type: Number, default: 1 })
  occurrence_count: number;

  // Lần xảy ra gần nhất — dùng để sắp xếp và tính hạn lưu trữ (TTL index cuối file)
  @Prop({ type: Date, default: () => new Date() })
  last_occurred_at: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const NotificationLogSchema =
  SchemaFactory.createForClass(NotificationLog);

NotificationLogSchema.index({
  scope: 1,
  target_resource: 1,
  last_occurred_at: -1,
});
NotificationLogSchema.index({ dedupe_key: 1, status: 1, last_occurred_at: -1 });

// Tự xóa vật lý sau NOTIFICATION_RETENTION_DAYS kể từ lần xảy ra gần nhất.
// Thông báo được gộp (×N) tự "gia hạn" vì last_occurred_at được cập nhật mỗi lần lặp lại.
NotificationLogSchema.index(
  { last_occurred_at: 1 },
  { expireAfterSeconds: NOTIFICATION_RETENTION_DAYS * 24 * 3600 },
);
