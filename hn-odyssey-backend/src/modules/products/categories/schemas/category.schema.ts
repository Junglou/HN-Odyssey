import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose'; // Thêm Types

export type CategoryDocument = Category & Document;

@Schema({ _id: false })
export class SeoConfig {
  @Prop()
  meta_title: string;

  @Prop()
  meta_description: string;
}

@Schema({ _id: false })
export class Ancestor {
  @Prop({ type: MongooseSchema.Types.ObjectId })
  _id: string;

  @Prop()
  name: string;

  @Prop()
  slug: string;
}

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category', default: null })
  parent_id: Types.ObjectId;

  @Prop({ type: [Ancestor], default: [] })
  ancestors: Ancestor[];

  @Prop()
  description: string;

  @Prop()
  image: string;

  @Prop()
  alt_text: string;

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ default: 0 })
  display_order: number;

  @Prop({ type: SeoConfig, default: {} })
  seo_config: SeoConfig;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index({ name: 'text' });
CategorySchema.index({ parent_id: 1, display_order: 1 });
