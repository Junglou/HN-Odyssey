import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ReviewStatus } from 'src/common/enums/review.enum';

// Sub-schema cho Media
@Schema({ _id: false })
export class ReviewMedia {
  @Prop({ required: true })
  url: string;

  @Prop({ enum: ['IMAGE', 'VIDEO'], default: 'IMAGE' })
  type: string;

  @Prop()
  thumbnail?: string;
}
const ReviewMediaSchema = SchemaFactory.createForClass(ReviewMedia);

// THÊM MỚI: Sub-schema cho Customer Reply
@Schema({ _id: true, timestamps: true })
export class CustomerReply {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [ReviewMediaSchema], default: [] })
  media: ReviewMedia[];
}
const CustomerReplySchema = SchemaFactory.createForClass(CustomerReply);

export type ReviewDocument = Review & Document;

@Schema({ timestamps: true, collection: 'reviews' })
export class Review extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  product_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  order_id: Types.ObjectId;

  @Prop({ required: true })
  variant_sku: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: String, maxlength: 1000 })
  content: string;

  @Prop({ type: [ReviewMediaSchema], default: [] })
  media: ReviewMedia[];

  @Prop({ default: false })
  is_anonymous: boolean;

  @Prop({
    type: [
      {
        old_rating: Number,
        old_content: String,
        edited_at: Date,
      },
    ],
    default: [],
  })
  edit_history: { old_rating: number; old_content: string; edited_at: Date }[];

  @Prop({ default: 0 })
  helpful_count: number;

  @Prop({ type: [String], default: [] })
  liked_by_users: string[];

  // Admin Reply (Giữ nguyên)
  @Prop({
    type: {
      content: String,
      staff_id: { type: Types.ObjectId, ref: 'User' },
      replied_at: Date,
    },
    default: null,
  })
  reply?: { content: string; staff_id: Types.ObjectId; replied_at: Date };

  // THÊM MỚI: Mảng chứa reply của khách hàng
  @Prop({ type: [CustomerReplySchema], default: [] })
  customer_replies: CustomerReply[];

  @Prop({
    required: true,
    enum: ReviewStatus,
    default: ReviewStatus.NEW,
    index: true,
  })
  status: ReviewStatus;

  @Prop({ default: false, index: true })
  is_pinned: boolean;

  @Prop({ type: Date, default: null })
  pinned_at?: Date | null;

  @Prop({ default: true })
  is_verified_purchase: boolean;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.index({
  product_id: 1,
  status: 1,
  is_pinned: -1,
  pinned_at: -1,
  createdAt: -1,
});
// BỎ INDEX UNIQUE NÀY ĐỂ CHO PHÉP REVIEW NHIỀU LẦN
// ReviewSchema.index(
//   { order_id: 1, product_id: 1, variant_sku: 1 },
//   { unique: true },
// );
