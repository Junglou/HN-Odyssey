import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AttributeDocument = Attribute & Document;

@Schema({ _id: false }) 
export class AttributeValue {
  @Prop({ required: true })
  value: string; // "Đỏ", "XL"

  @Prop()
  meta?: string; // Mã màu hex (nếu là màu) #FF0000
}

@Schema({ timestamps: true })
export class Attribute {
  @Prop({ required: true, unique: true, trim: true })
  name: string; // Tên nhóm: "Color", "Size", "Material"

  @Prop()
  description: string;

  @Prop({ type: [AttributeValue], default: [] })
  values: AttributeValue[];

  @Prop({ default: true })
  is_active: boolean;
}

export const AttributeSchema = SchemaFactory.createForClass(Attribute);
