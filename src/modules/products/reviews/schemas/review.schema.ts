import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReviewDocument = Review & Document;

@Schema({ timestamps: true })
export class Review extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  product_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  order_id: Types.ObjectId;

  @Prop({ required: true })
  variant_sku: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop()
  content: string;

  @Prop({ type: [{ url: String, type: String, thumbnail: String }] })
  media: { url: string; type: 'IMAGE' | 'VIDEO'; thumbnail?: string }[];

  @Prop({
    type: { content: String, staff_id: Types.ObjectId, replied_at: Date },
    default: null,
  })
  reply?: { content: string; staff_id: Types.ObjectId; replied_at: Date };

  @Prop({ default: 'APPROVED', enum: ['PENDING', 'APPROVED', 'HIDDEN'] })
  status: string;

  @Prop({ default: 0 })
  helpful_count: number;

  @Prop({ type: [String], default: [] })
  liked_by_users: string[];
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
ReviewSchema.index({ product_id: 1, status: 1, created_at: -1 });
