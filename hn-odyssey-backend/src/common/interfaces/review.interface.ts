import { Types } from 'mongoose';
import { ReviewStatus } from '../enums/review.enum';

export interface IReviewMedia {
  url: string;
  type: 'IMAGE' | 'VIDEO';
  thumbnail?: string;
}

export interface IReviewReply {
  content: string;
  staff_id: Types.ObjectId | string;
  replied_at: Date;
}

export interface IReviewEditHistory {
  old_rating: number;
  old_content: string;
  edited_at: Date;
}

export interface IReviewCustomer {
  _id: Types.ObjectId;
  full_name?: string;
  email?: string;
  is_active?: boolean;
}

export interface IReview {
  _id: Types.ObjectId;
  product_id: Types.ObjectId;
  customer_id: IReviewCustomer;
  order_id: Types.ObjectId;
  rating: number;
  content: string;
  images: string[];
  status: ReviewStatus;
  reply_content?: string;
  replied_at?: Date;
  replied_by?: Types.ObjectId;
  is_pinned: boolean;
  pinned_at?: Date | null;
  is_verified_purchase: boolean;
  createdAt: Date;
  updatedAt: Date;
}
