import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export enum PostStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  HIDDEN = 'HIDDEN',
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class BlogPost extends Document {
  // AC1: Gán thông tin tác giả
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  author_id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  // AC3: Đường dẫn tĩnh SEO
  @Prop({ required: true, unique: true, trim: true, index: true })
  slug: string;

  @Prop({ required: true })
  summary: string;

  // AC2: Rich Text HTML
  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  thumbnail: string;

  // AC5: Phân loại danh mục
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category', default: null })
  category_id?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags: string[];

  // AC8: Nhúng Widget sản phẩm vào nội dung
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Product' }],
    default: [],
  })
  embedded_product_ids: Types.ObjectId[];

  // AC3: Cấu hình SEO
  @Prop({ trim: true, default: '' })
  meta_title: string;

  @Prop({ trim: true, default: '' })
  meta_description: string;

  @Prop({
    required: true,
    enum: PostStatus,
    default: PostStatus.DRAFT,
    index: true,
  })
  status: PostStatus;

  // AC4: Lên lịch đăng bài tự động
  @Prop({ type: Date, default: null, index: true })
  published_at: Date | null;

  // AC6: Xóa mềm
  @Prop({ default: false, index: true })
  is_deleted: boolean;

  @Prop({ type: Date, default: null })
  deleted_at: Date | null;
}

export const BlogPostSchema = SchemaFactory.createForClass(BlogPost);
