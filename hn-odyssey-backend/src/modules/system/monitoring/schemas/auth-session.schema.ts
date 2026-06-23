import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuthSessionDocument = AuthSession & Document;

@Schema({ timestamps: true })
export class AuthSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true })
  ip_address: string;

  @Prop({ required: true })
  user_agent: string; // Trình duyệt, OS

  @Prop({ required: true })
  device_fingerprint: string; // Hash của IP + UserAgent để nhận diện thiết bị

  @Prop({ default: true })
  is_active: boolean;

  @Prop()
  last_login_at: Date;
}

export const AuthSessionSchema = SchemaFactory.createForClass(AuthSession);
