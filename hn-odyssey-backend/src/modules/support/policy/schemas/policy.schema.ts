import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PolicyDocument = Policy & Document;

@Schema({ timestamps: true })
export class Policy {
  @Prop({ required: true })
  title: string; // Tên chính sách (VD: Chính sách bảo hành)

  @Prop({ type: [String], required: true, index: true })
  keywords: string[]; // Các từ khóa để AI n8n match (VD: ['bảo hành', 'lỗi'])

  @Prop({ required: true })
  content: string; // Nội dung chi tiết trả về cho Chatbot

  @Prop({ default: true })
  is_active: boolean; // Trạng thái bật/tắt chính sách
}

export const PolicySchema = SchemaFactory.createForClass(Policy);
