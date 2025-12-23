import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: true })
export class VariantAttribute {
  @Prop({ required: true })
  k: string; // Key. Ví dụ: "color" hoặc "Màu sắc" (lấy từ Attribute name)

  @Prop({ required: true })
  v: string; // Value. Ví dụ: "Đỏ"

  @Prop()
  u?: string; // Unit (nếu có). Ví dụ: "cm"
}

@Schema({ _id: true, timestamps: false })
export class ProductVariant {
  // AC3: SKU riêng cho biến thể
  @Prop({ required: true, trim: true, sparse: true }) // sparse: true để tránh lỗi duplicate null
  sku: string;

  // AC3: Giá riêng (nếu khác giá cha)
  @Prop({ default: 0 })
  price: number;

  @Prop({ default: 0 })
  sale_price: number; // Biến thể cũng có thể giảm giá riêng

  // AC3: Tồn kho riêng
  @Prop({ required: true, default: 0 })
  stock: number;

  // AC4: Ảnh riêng cho biến thể (Ví dụ chọn màu Đỏ ra ảnh áo Đỏ)
  @Prop()
  image: string;

  // Định nghĩa các thuộc tính: [{k: "Màu", v: "Đỏ"}, {k: "Size", v: "M"}]
  @Prop({ type: [VariantAttribute], default: [] })
  attributes: VariantAttribute[];

  // AC6: Trạng thái riêng (Ví dụ: Size S ngừng kinh doanh)
  @Prop({ default: true })
  active: boolean;
}

export const ProductVariantSchema =
  SchemaFactory.createForClass(ProductVariant);
