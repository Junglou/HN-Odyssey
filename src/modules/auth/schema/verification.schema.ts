import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'verifications', timestamps: true })
export class Verification extends Document {
  @Prop({ required: true, index: true })
  target: string;

  @Prop({ required: true })
  code: string;

  @Prop({
    required: true,
    enum: ['REGISTER', 'RESET_PASSWORD', 'ADMIN_RESET_PASSWORD'],
  })
  type: string;

  @Prop({ required: true })
  expired_at: Date;

  // TTL Index: Tự động xóa bản ghi này khỏi DB sau 5 phút (300s) kể từ khi tạo
  // Lưu ý: MongoDB sẽ quét và xóa ngầm, có thể chậm vài giây.
  @Prop({ expires: 300 })
  created_at: Date;
}

export const VerificationSchema = SchemaFactory.createForClass(Verification);
