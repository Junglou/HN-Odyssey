import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum MediaType {
  PRODUCT = 'Product',
  CATEGORY = 'Category',
  VARIANT = 'Variant',
}

export enum MediaStatus {
  PUBLISHED = 'Published',
  DRAFT = 'Draft',
  HIDDEN = 'Hidden',
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Media extends Document {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  fileName: string; // Tên file đã xử lý để tránh trùng lặp

  @Prop({ required: true })
  originalName: string; // Giữ nguyên tên gốc có dấu, khoảng trắng (Đáp ứng AC2)

  @Prop({ required: true, enum: MediaType })
  type: MediaType;

  @Prop({ required: true })
  targetId: string;

  @Prop({ required: true, enum: MediaStatus, default: MediaStatus.DRAFT })
  status: MediaStatus;

  @Prop({ required: true, default: false })
  isPrimary: boolean;

  @Prop({ default: '' })
  altText: string;

  @Prop({ required: true })
  size: number;

  @Prop({ required: true })
  mimetype: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  created_by: Types.ObjectId;
}

export const MediaSchema = SchemaFactory.createForClass(Media);
