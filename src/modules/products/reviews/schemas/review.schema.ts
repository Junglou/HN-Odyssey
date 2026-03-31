import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import type {
  IReviewEditHistory,
  IReviewReply,
} from 'src/common/interfaces/review.interface';

// 1. Tạo Sub-Schema cho Media (Quan trọng!)
@Schema({ _id: false }) // Không cần tạo _id riêng cho từng ảnh/video
class ReviewMedia {
  @Prop({ required: true })
  url: string;

  @Prop({ enum: ['IMAGE', 'VIDEO'], default: 'IMAGE' })
  type: string;

  @Prop()
  thumbnail?: string;
}
const ReviewMediaSchema = SchemaFactory.createForClass(ReviewMedia);

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

  @Prop({
    type: [ReviewMediaSchema], // Sử dụng Schema thay vì Object literal
    default: [],
  })
  media: ReviewMedia[];

  // AC9: Đánh giá ẩn danh
  @Prop({ default: false })
  is_anonymous: boolean;

  // AC2: Lịch sử chỉnh sửa đánh giá
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
  edit_history: IReviewEditHistory[];

  @Prop({
    type: { content: String, staff_id: Types.ObjectId, replied_at: Date },
    default: null,
  })
  reply?: IReviewReply;

  @Prop({ default: 'APPROVED', enum: ['PENDING', 'APPROVED', 'HIDDEN'] })
  status: string;

  @Prop({ default: 0 })
  helpful_count: number;

  @Prop({ type: [String], default: [] })
  liked_by_users: string[];
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
ReviewSchema.index({ product_id: 1, status: 1, createdAt: -1 });
ReviewSchema.index(
  { order_id: 1, product_id: 1, variant_sku: 1 },
  { unique: true },
); // Chống spam AC2
