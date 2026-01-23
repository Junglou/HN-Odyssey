import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AttributeType } from 'src/common/enums/attribute-type.enum';

export type AttributeDocument = Attribute & Document;

@Schema({ _id: false })
export class AttributeValue {
  @Prop({ required: true })
  label: string; // Tên hiển thị (VD: Đỏ, XL)

  @Prop({ required: true })
  value: string; // Giá trị lưu DB (VD: red, xl) - Dùng để query

  @Prop()
  meta?: string; // AC4: Mã màu hex (#FF0000) hoặc URL ảnh
}

@Schema({ timestamps: true, collection: 'attributes' })
export class Attribute {
  // AC11: Tên không quá 255 ký tự
  @Prop({ required: true, trim: true, maxlength: 255 })
  name: string;

  //AC6, AC11: Mã Code định danh (slug) - Bắt buộc unique
  @Prop({ required: true, unique: true, trim: true })
  code: string;

  //AC2: Kiểu hiển thị
  @Prop({ required: true, enum: AttributeType })
  display_type: AttributeType;

  @Prop()
  description: string;

  @Prop({ type: [AttributeValue], default: [] })
  values: AttributeValue[];

  // AC5: Áp dụng cho danh mục nào (Rỗng = All)
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Category' }], default: [] })
  applicable_categories: Types.ObjectId[];

  // AC8: Cho phép lọc ở sidebar không?
  @Prop({ default: true })
  is_filterable: boolean;

  // AC7: Thứ tự hiển thị
  @Prop({ default: 0 })
  sort_order: number;

  @Prop({ default: true })
  is_active: boolean;
}

export const AttributeSchema = SchemaFactory.createForClass(Attribute);

// Index để tối ưu tìm kiếm và Unique
AttributeSchema.index({ is_filterable: 1, is_active: 1, sort_order: 1 });
