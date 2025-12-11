import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'users',
  timestamps: true,
  discriminatorKey: 'type', // Key để phân biệt loại user
})
export class User {
  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: false, unique: true, index: true, sparse: true })
  phone: string;

  @Prop({ required: false }) // Có thể null nếu login bằng Google/Facebook
  password?: string;

  @Prop({ required: true })
  full_name: string;

  @Prop({ type: Object, default: {} })
  social_auth: {
    google_id?: string;
    facebook_id?: string;
  };

  @Prop({
    type: [String],
    enum: ['CUSTOMER', 'STAFF', 'ADMIN'],
    default: ['CUSTOMER'],
  })
  roles: string[];

  @Prop({ default: true })
  is_active: boolean; // US.56: Trạng thái hoạt động

  // US.02: Bảo mật đăng nhập
  @Prop({ default: 0 })
  login_attempts: number;

  @Prop({ type: Date, default: null })
  lock_until: Date;

  // Trường bắt buộc cho Discriminator
  type: string;
  @Prop({ type: String, default: null })
  refresh_token: string | null;
}

export type UserDocument = User & Document;

export const UserSchema = SchemaFactory.createForClass(User);

// Index Text để tìm kiếm theo tên/email/sđt (US.15)
UserSchema.index({ full_name: 'text', email: 'text', phone: 'text' });
