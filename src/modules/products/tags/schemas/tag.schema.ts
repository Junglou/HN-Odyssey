import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { TagScope } from '../../../../common/enums/tag-scope.enum';

export type TagDocument = Tag & Document;

@Schema({ timestamps: true })
export class Tag {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ required: true, enum: TagScope, default: TagScope.PRODUCT })
  scope: string;

  @Prop()
  description: string;

  // AC7: Visual Configuration
  @Prop({ default: '#E0E0E0' }) // Màu xám nhạt mặc định
  bg_color: string;

  @Prop({ default: '#333333' }) // Màu chữ đen mặc định
  text_color: string;

  // AC1: Tracking usage (Update real-time hoặc count khi cần)
  @Prop({ default: 0 })
  usage_count: number;
}

export const TagSchema = SchemaFactory.createForClass(Tag);
// Đánh index để search nhanh và check trùng
TagSchema.index({ name: 1, scope: 1 }, { unique: true });
