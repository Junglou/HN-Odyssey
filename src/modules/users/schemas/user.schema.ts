import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserStatus } from 'src/common/enums/user-status.enum';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

@Schema({
  collection: 'users',
  timestamps: true,
  discriminatorKey: 'type', // Key để phân biệt loại user
  toJSON: { virtuals: true },
})
export class User {
  @Prop({ default: null })
  avatar: string;

  readonly fullName: string; // Sẽ được xử lý qua Virtual ở cuối file

  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: false, unique: true, index: true, sparse: true })
  phone: string;

  @Prop({ required: false }) // Có thể null nếu login bằng Google/Facebook
  password?: string;

  @Prop({ required: true })
  first_Name: string;

  @Prop({ required: true })
  last_Name: string;

  // BỔ SUNG CHO TRANG CÁ NHÂN (AC1, AC2)
  @Prop({ enum: Gender, default: Gender.OTHER })
  gender: Gender;

  @Prop({ type: Date, default: null })
  dateOfBirth: Date;

  // BỔ SUNG XÁC THỰC EMAIL/PHONE (AC4, AC12, AC13, AC14)
  @Prop({ type: String, default: null, select: false })
  pending_email: string; // Lưu tạm email mới đang chờ xác thực

  @Prop({ type: String, default: null, select: false })
  pending_phone: string; // Lưu tạm SĐT mới đang chờ xác thực

  @Prop({ type: String, default: null, select: false })
  verification_code: string; // Mã OTP hoặc Token Link

  @Prop({ type: Date, default: null, select: false })
  verification_code_expires_at: Date; // AC12: Hết hạn sau 5 phút

  @Prop({ type: Date, default: null, select: false })
  last_code_sent_at: Date; // AC13: Cooldown 60s giữa các lần gửi

  @Prop({ type: Number, default: 0, select: false })
  failed_otp_attempts: number; // AC14: Đếm số lần nhập sai OTP đổi thông tin

  @Prop({ type: Date, default: null, select: false })
  otp_locked_until: Date; // AC14: Khóa cập nhật 15-30 phút nếu sai quá 5 lần

  @Prop({ type: Object, default: {} })
  social_auth: {
    google_id?: string;
    facebook_id?: string;
  };

  @Prop({
    type: [String],
    default: ['CUSTOMER'],
  })
  roles: string[];

  @Prop({ enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  // AC10: Dùng trường này để Revoke sessions khi đổi mật khẩu!
  @Prop({ default: 0 })
  token_version: number;

  // US.02: Bảo mật đăng nhập
  @Prop({ default: 0 })
  login_attempts: number;

  @Prop({ type: Date, default: null })
  lock_until: Date | null;

  // Trường bắt buộc cho Discriminator
  type: string;

  @Prop({ type: String, default: null })
  refresh_token: string | null;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('fullName').get(function () {
  // 1. Nếu có đủ họ tên
  if (this.first_Name && this.last_Name) {
    return `${this.first_Name} ${this.last_Name}`;
  }
  // 2. Nếu không có gì cả, trả về email (bỏ phần @domain đi cho gọn) hoặc string rỗng
  return this.email ? this.email.split('@')[0] : '';
});

// Index Text để tìm kiếm theo tên/email/sđt (US.15)
UserSchema.index({
  first_Name: 'text',
  last_Name: 'text',
  email: 'text',
  phone: 'text',
  employee_code: 'text',
});
