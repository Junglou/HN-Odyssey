import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'Conversation',
    index: true,
    required: true,
  })
  conversation_id: Types.ObjectId;

  @Prop({ required: true, enum: ['USER', 'BOT', 'AGENT', 'SYSTEM'] })
  sender_type: string;

  @Prop()
  sender_id?: string;

  @Prop({ required: true })
  content: string;

  @Prop({
    type: String,
    enum: ['TEXT', 'IMAGE', 'PRODUCT_CARD', 'FILE'],
    default: 'TEXT',
  })
  message_type: string;

  @Prop({ type: Object })
  metadata?: any;

  @Prop({ default: false })
  is_read: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
