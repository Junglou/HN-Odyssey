import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefreshSessionDocument = HydratedDocument<RefreshSession>;

// Mỗi bản ghi = 1 thiết bị đang đăng nhập
@Schema({ collection: 'refresh_sessions', timestamps: true })
export class RefreshSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true, unique: true })
  session_id: string;

  @Prop({ required: true })
  token_hash: string; // SHA-256 của refresh token hiện hành

  @Prop({ type: String, default: null })
  prev_token_hash: string | null; // Token liền trước, chấp nhận trong 60s (nhiều tab refresh cùng lúc)

  @Prop({ type: Date, default: null })
  rotated_at: Date | null;

  @Prop({ default: false })
  remember_me: boolean;

  @Prop({ default: 'Unknown' })
  ip: string;

  @Prop({ default: 'Unknown' })
  user_agent: string;

  @Prop({ type: Date, default: null })
  last_used_at: Date | null;

  @Prop({ type: Date, required: true })
  expires_at: Date;
}

export const RefreshSessionSchema =
  SchemaFactory.createForClass(RefreshSession);

// MongoDB tự xóa phiên khi quá hạn
RefreshSessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
