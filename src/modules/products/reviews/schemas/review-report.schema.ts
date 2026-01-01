import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReviewReportDocument = ReviewReport & Document;

@Schema({ timestamps: true })
export class ReviewReport extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Review', required: true, index: true })
  review_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporter_id: Types.ObjectId;

  @Prop({ required: true })
  reason: string;

  @Prop({ default: 'PENDING', enum: ['PENDING', 'RESOLVED', 'IGNORED'] })
  status: string; 
}

export const ReviewReportSchema = SchemaFactory.createForClass(ReviewReport);
