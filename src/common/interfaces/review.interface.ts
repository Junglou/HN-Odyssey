import { Types } from 'mongoose';

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
