import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserStatus } from 'src/common/enums/user-status.enum';

@Schema({
  collection: 'users',
  timestamps: true,
  discriminatorKey: 'type', // Key để phân biệt loại user
  toJSON: { virtuals: true },
})
export class User {
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

  fullName: string;

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

  @Prop({ default: 0 })
  token_version: number;
  // Mỗi khi user đổi mật khẩu hoặc bị admin khóa,
  // ta tăng số này lên 1 để vô hiệu hóa toàn bộ Token cũ.

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

UserSchema.virtual('fullName').get(function (this: UserDocument) {
  return `${this.last_Name} ${this.first_Name}`;
});

// Index Text để tìm kiếm theo tên/email/sđt (US.15)
UserSchema.index({
  first_Name: 'text',
  last_Name: 'text',
  email: 'text',
  phone: 'text',
});
