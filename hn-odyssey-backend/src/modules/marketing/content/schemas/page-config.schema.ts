import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ _id: false })
export class EditorElement {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) type: string;
  @Prop({ required: true }) x: number;
  @Prop({ required: true }) y: number;
  @Prop({ required: true }) width: number;
  @Prop({ required: true }) height: number;
  @Prop({ default: '' }) content: string;
  @Prop({ default: null }) link?: string;
  @Prop({ default: 'p' }) tag?: string;
  @Prop({ default: 0 }) rotate?: number;
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} }) style?: Record<
    string,
    any
  >;
}

@Schema({ _id: false })
export class SectionConfig {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) pageId: string;
  @Prop({ required: true }) name: string;
  @Prop({ default: '' }) backgroundUrl: string;
  @Prop({ type: [EditorElement], default: [] }) elements: EditorElement[];
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class PageConfig extends Document {
  @Prop({ required: true, unique: true, index: true })
  pageId: string; // Tương ứng PageType ở FE: 'homepage', 'about_us', 'contact', 'product_page', 'global'

  @Prop({ type: [SectionConfig], default: [] })
  sections: SectionConfig[];
}

export const PageConfigSchema = SchemaFactory.createForClass(PageConfig);
