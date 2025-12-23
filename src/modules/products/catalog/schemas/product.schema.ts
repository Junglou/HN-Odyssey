import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { ProductStatus } from '../../../../common/enums/product-status.enum';
import { ProductVariant, ProductVariantSchema } from './product-variant.schema';
import { Category } from '../../categories/schemas/category.schema';

export type ProductDocument = Product & Document;

@Schema({ _id: false })
export class ProductSeo {
  @Prop() meta_title: string;
  @Prop() meta_description: string;
  @Prop() meta_keywords: string;
}

@Schema({ _id: false })
export class ProductAttributeParams {
  @Prop() name: string; // Ví dụ: "Màu sắc"
  @Prop() values: string[]; // Ví dụ: ["Đỏ", "Xanh"] - Dùng để hiển thị filter nhanh
}

//Schema phụ để lưu giá chờ duyệt của Biến thể (AC6)
@Schema({ _id: false })
export class PendingVariantPrice {
  @Prop({ required: true })
  sku: string;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 0 })
  sale_price: number;
}

//Schema lưu yêu cầu thay đổi giá (Bao gồm cả SP cha và Biến thể)
@Schema({ _id: false })
export class PendingPriceChange {
  // Giá của sản phẩm cha
  @Prop({ required: true })
  price: number;

  @Prop({ default: 0 })
  sale_price: number;

  @Prop()
  sale_start_date?: Date;

  @Prop()
  sale_end_date?: Date;

  // Danh sách giá biến thể chờ duyệt
  @Prop({ type: [PendingVariantPrice], default: [] })
  variants?: PendingVariantPrice[];

  @Prop({ required: true })
  requester_id: string;

  @Prop({ default: Date.now })
  requested_at: Date;
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Product {
  //THÔNG TIN CƠ BẢN (US.72)
  @Prop({ required: true, trim: true, index: 'text' })
  name: string;

  @Prop({ required: true, unique: true, trim: true })
  sku: string;

  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ type: String })
  description: string;

  @Prop({ default: '' })
  short_description: string;

  @Prop()
  brand: string;

  //PHÂN LOẠI & TAGS
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Category' }],
    required: true,
  })
  categories: Category[];

  @Prop({ type: [String], index: true })
  tags: string[];

  //THÔNG SỐ KỸ THUẬT
  @Prop({ type: [ProductAttributeParams], default: [] })
  specs: ProductAttributeParams[]; // VD: [{ name: "Màu", values: ["Đỏ", "Xanh"] }]

  //MEDIA (US.73)
  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop()
  thumbnail: string;

  @Prop()
  video: string;

  //GIÁ & KHUYẾN MÃI (US.75)
  @Prop({ required: true, default: 0 })
  price: number; 

  @Prop({ default: 0 })
  sale_price: number; 

  @Prop()
  sale_start_date: Date; 

  @Prop()
  sale_end_date: Date;

  //BIẾN THỂ (US.74)
  @Prop({ type: [ProductVariantSchema], default: [] })
  variants: ProductVariant[];

  @Prop({ default: false })
  has_variants: boolean;

  // TỒN KHO & VẬN CHUYỂN (US.78)
  @Prop({ default: 0 })
  stock: number;

  @Prop({ default: 0 })
  stock_on_hold: number;

  @Prop({ default: 0 })
  min_stock: number;

  @Prop({ default: 0 })
  max_stock: number;

  @Prop({ default: false })
  allow_backorder: boolean;

  @Prop({ default: 0 })
  weight: number;

  // TRẠNG THÁI & SEO
  @Prop({
    required: true,
    enum: ProductStatus,
    default: ProductStatus.DRAFT,
  })
  status: ProductStatus;

  @Prop({ type: ProductSeo })
  seo_config: ProductSeo;

  // THỐNG KÊ & ĐÁNH GIÁ
  @Prop({ default: 0 })
  view_count: number;

  @Prop({ default: 0 })
  sold_count: number;

  @Prop({ default: 0, index: true })
  rating_average: number;

  @Prop({ default: 0 })
  review_count: number;

  // Trường lưu dữ liệu chờ duyệt giá
  @Prop({ type: PendingPriceChange, default: null })
  pending_price_change: PendingPriceChange | null;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Indexing
ProductSchema.index({ status: 1, price: 1 });
ProductSchema.index({ categories: 1, status: 1 });
ProductSchema.index({ tags: 1, status: 1 });
ProductSchema.index({ rating_average: -1 });
