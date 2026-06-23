import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum PageStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  HIDDEN = 'HIDDEN',
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class StaticPage extends Document {
  @Prop({ required: true, trim: true })
  title: string;

  // AC2: URL Friendly
  @Prop({ required: true, unique: true, trim: true, index: true })
  slug: string;

  @Prop({ required: true })
  content: string;

  // Bổ sung dưới trường content:
  @Prop({ default: 'About Us' })
  type: string;

  // AC3: Tối ưu SEO
  @Prop({ trim: true, default: '' })
  meta_title: string;

  @Prop({ trim: true, default: '' })
  meta_description: string;

  // AC4: Trạng thái hiển thị
  @Prop({ required: true, enum: PageStatus, default: PageStatus.DRAFT })
  status: PageStatus;

  // AC6: Logic chặn xóa trang hệ thống (VD: 404, Chính sách bảo mật)
  @Prop({ default: false })
  is_system: boolean;

  @Prop({ default: false, index: true })
  is_deleted: boolean;

  @Prop({ type: Date, default: null })
  deleted_at: Date | null;
}

export const StaticPageSchema = SchemaFactory.createForClass(StaticPage);
