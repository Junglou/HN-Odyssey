import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export enum MenuPosition {
  HEADER = 'HEADER',
  FOOTER = 'FOOTER',
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class MenuConfig extends Document {
  @Prop({ required: true, trim: true })
  title: string;

  // URL ngoài hoặc Slug liên kết tới Static Page
  @Prop({ required: true, trim: true })
  link: string;

  // AC5 (US.126): Liên kết vào Menu Header/Footer
  @Prop({ required: true, enum: MenuPosition, index: true })
  position: MenuPosition;

  // Hỗ trợ Menu đa cấp (Sub-menu)
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'MenuConfig',
    default: null,
  })
  parent_id?: Types.ObjectId | null;

  @Prop({ default: 0 })
  display_order: number;

  @Prop({ default: true })
  is_active: boolean;
}

export const MenuConfigSchema = SchemaFactory.createForClass(MenuConfig);
MenuConfigSchema.index({ position: 1, display_order: 1 });
