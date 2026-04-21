import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ConversationStatus {
  BOT = 'BOT',
  OPEN = 'OPEN', // Đang chat với nhân viên
  CLOSED = 'CLOSED',
  OFFLINE_TICKET = 'OFFLINE_TICKET',
}

@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  customer_id?: Types.ObjectId; // Null nếu là Guest

  @Prop({ index: true })
  session_id: string; // Dùng cho Guest (AC1, AC8)

  @Prop({ type: Types.ObjectId, ref: 'User' })
  agent_id?: Types.ObjectId; // Nhân viên tiếp nhận (AC5, AC9)

  @Prop({ enum: ConversationStatus, default: ConversationStatus.BOT })
  status: ConversationStatus;

  @Prop({ type: Object })
  context: {
    current_page?: string; // AC3: Nhận diện trang đang xem
    last_product_id?: string;
    device?: string;
  };

  @Prop({ type: Object })
  csat?: {
    // AC13: Đánh giá sau hội thoại
    rating: number;
    comment: string;
    rated_at: Date;
  };

  @Prop()
  department_tag?: string; // AC9: Phân luồng (Sale, Kỹ thuật...)

  @Prop()
  opened_at?: Date; // Thời điểm Agent bắt đầu tiếp nhận

  @Prop()
  closed_at?: Date; // Thời điểm kết thúc phiên chat
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
