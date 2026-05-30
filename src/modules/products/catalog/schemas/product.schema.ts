import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { ProductStatus } from '../../../../common/enums/product-status.enum';
import {
  ProductVariant,
  ProductVariantSchema,
  VariantAttribute,
} from './product-variant.schema';
import { Category } from '../../categories/schemas/category.schema';

export type ProductDocument = Product & Document;

@Schema({ _id: false })
export class ProductMedia {
  @Prop({ required: true })
  url: string;

  @Prop({
    required: true,
    enum: ['IMAGE', 'VIDEO', '360_VIEW'],
    default: 'IMAGE',
  })
  type: string;

  @Prop()
  thumbnail?: string;

  @Prop()
  alt?: string;

  @Prop()
  color?: string; // Mapping màu sắc (VD: "red")

  @Prop({ default: 0 })
  display_order: number;

  @Prop()
  medium?: string;
}

@Schema({ _id: false })
export class ProductSeo {
  @Prop() meta_title: string;
  @Prop() meta_description: string;
  @Prop() meta_keywords: string;
}

// Dùng để hiển thị thông số nhanh ở trang chi tiết/card
@Schema({ _id: false })
export class ProductAttributeParams {
  @Prop() name: string; // Lưu Attribute Code (VD: "color", "size")
  @Prop() values: string[]; // VD: ["red", "blue", "xl"]
}

@Schema({ _id: false })
export class PendingVariantPrice {
  @Prop({ required: true }) sku: string;
  @Prop({ required: true }) price: number;
  @Prop({ default: 0 }) sale_price: number;
}

// Enum định nghĩa 4 trạng thái của Yêu cầu giá
export enum PriceRequestStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Schema({ _id: false })
export class PriceRequest {
  @Prop({ required: true }) price: number;

  @Prop({ default: 'VND' })
  currency: string;

  @Prop({ type: [PendingVariantPrice], default: [] })
  variants?: PendingVariantPrice[];

  // AC1: Ngày áp dụng
  @Prop({ required: true })
  effective_date: Date;

  @Prop({
    required: true,
    enum: PriceRequestStatus,
    default: PriceRequestStatus.DRAFT,
  })
  status: PriceRequestStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  requester_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  approver_id?: Types.ObjectId;

  @Prop({ default: Date.now })
  requested_at: Date;

  @Prop()
  reject_reason?: string;
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

  @Prop({ type: [String], default: [], index: true })
  old_slugs: string[];

  @Prop({ type: String })
  description: string;

  @Prop({ default: '' })
  short_description: string;

  // Thêm vào trong class Product ở file product.schema.ts
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Warehouse', index: true })
  warehouse_id: Types.ObjectId;

  //MEDIA
  @Prop({ type: [ProductMedia], default: [] })
  gallery: ProductMedia[];

  @Prop({ type: [String], default: [] }) // Giữ lại để tương thích ngược nếu cần, hoặc dùng gallery là chính
  images: string[];

  @Prop()
  video: string;

  @Prop()
  thumbnail: string;

  //CẤU HÌNH BÁN HÀNG
  @Prop({ default: null })
  max_purchase_qty?: number;

  @Prop({ default: 1 })
  min_purchase_qty: number;

  @Prop({ default: false })
  is_member_only: boolean;

  // THÊM: AC4 - Giá riêng cho từng hạng thành viên (VD: { "GOLD": 90000 })
  @Prop({ type: Object, default: {} })
  member_prices: Record<string, number>;

  // THÊM: AC5 - Yêu cầu rank tối thiểu để mua sớm
  @Prop({ default: 0 })
  rank_required: number;

  // THÊM: AC10 - Chỉ cho phép các hạng cụ thể đổi quà
  @Prop({ type: [String], default: [] })
  allowed_tiers: string[];

  //PHÂN LOẠI & TAGS
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Category' }],
    required: true,
  })
  categories: Category[];

  @Prop({
    type: [String],
    index: true,
    // Tự động lowercase và xóa khoảng trắng thừa ở 2 đầu
    set: (tags: string[]) =>
      tags ? tags.map((tag) => tag.toLowerCase().trim()) : [],
  })
  tags: string[];

  @Prop({ type: [ProductAttributeParams], default: [] })
  specs: ProductAttributeParams[];

  @Prop({ type: [Object], default: [] }) // Object ở đây là VariantAttribute
  attributes: VariantAttribute[];

  //GIÁ & KHUYẾN MÃI (US.75)
  @Prop({ required: true, default: 0 })
  price: number;

  @Prop({ default: 'VND' })
  currency: string;

  @Prop({ default: 0 })
  sale_price: number;

  @Prop()
  sale_start_date: Date;

  @Prop()
  sale_end_date: Date;

  // THÊM 2 TRƯỜNG NÀY PHỤC VỤ THUẬT TOÁN GỢI Ý (ContextualCartService)
  @Prop({ default: false, index: true })
  is_flash_sale: boolean;

  @Prop({ default: 1 }) // Thang điểm 1-5, mặc định là 1 (lời ít)
  margin_tier: number;

  //BIẾN THỂ (US.74)
  @Prop({ type: [ProductVariantSchema], default: [] })
  variants: ProductVariant[];

  @Prop({ default: false })
  has_variants: boolean;

  //TỒN KHO & VẬN CHUYỂN (US.78)
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

  //TRẠNG THÁI & SEO
  @Prop({
    required: true,
    enum: ProductStatus,
    default: ProductStatus.DRAFT,
  })
  status: ProductStatus;

  @Prop({ type: ProductSeo })
  seo_config: ProductSeo;

  //THỐNG KÊ & DUYỆT GIÁ
  @Prop({ default: 0 })
  view_count: number;

  @Prop({ default: 0 })
  sold_count: number;

  @Prop({ default: 0 })
  rating_average: number;

  @Prop({ default: 0 })
  review_count: number;

  @Prop({ type: PriceRequest, default: null })
  price_request: PriceRequest | null;

  @Prop({ default: false, index: true })
  is_deleted: boolean;

  @Prop({ default: null })
  deleted_at: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

//VIRTUALS & INDEXES

// 1. Badge Virtual
ProductSchema.virtual('badges').get(function (this: Product) {
  const badges: { type: string; label: string }[] = [];

  if (this.stock <= 0) {
    badges.push({ type: 'OUT_OF_STOCK', label: 'Hết hàng' });
    return badges;
  }
  const productWithMeta = this as Product & { created_at?: Date };

  const createdAt = productWithMeta.created_at;
  const createdTime = createdAt instanceof Date ? createdAt.getTime() : 0;

  const isNew = new Date().getTime() - createdTime < 7 * 24 * 60 * 60 * 1000;

  if (isNew) badges.push({ type: 'NEW', label: 'Mới' });

  if (this.sale_price > 0 && this.sale_price < this.price) {
    const now = new Date();
    if (
      !this.sale_start_date ||
      !this.sale_end_date ||
      (now >= this.sale_start_date && now <= this.sale_end_date)
    ) {
      let percent = Math.floor(
        ((this.price - this.sale_price) / this.price) * 100,
      );
      if (percent >= 100 && this.sale_price > 0) percent = 99;
      if (percent > 0) badges.push({ type: 'SALE', label: `-${percent}%` });
    }
  }

  if (this.sold_count > 1000)
    badges.push({ type: 'BEST_SELLER', label: 'Bán chạy' });

  return badges;
});

// 2. Active Price Virtual
ProductSchema.virtual('current_active_price').get(function (this: Product) {
  const now = new Date();
  if (this.sale_price > 0 && this.sale_start_date && this.sale_end_date) {
    if (now >= this.sale_start_date && now <= this.sale_end_date) {
      return this.sale_price;
    }
    return this.price;
  }
  if (this.sale_price > 0 && this.sale_price < this.price) {
    return this.sale_price;
  }
  return this.price;
});

ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });
ProductSchema.index({ status: 1, price: 1 });
ProductSchema.index({ categories: 1, status: 1 });
ProductSchema.index({ tags: 1, status: 1 });
ProductSchema.index({ rating_average: -1 });
ProductSchema.index({ name: 'text', tags: 'text' });
// ProductSchema.index({
//   categories: 1,
//   'attributes.code': 1,
//   'attributes.value': 1,
// });
ProductSchema.index({ categories: 1 });
ProductSchema.index({ 'attributes.code': 1, 'attributes.value': 1 });
