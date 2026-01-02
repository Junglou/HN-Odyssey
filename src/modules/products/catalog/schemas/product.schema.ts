import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { ProductStatus } from '../../../../common/enums/product-status.enum';
import { ProductVariant, ProductVariantSchema } from './product-variant.schema';
import { Category } from '../../categories/schemas/category.schema';

export type ProductDocument = Product & Document;

@Schema({ _id: false })
export class ProductMedia {
  @Prop({ required: true })
  url: string; // Link ảnh/video

  @Prop({
    required: true,
    enum: ['IMAGE', 'VIDEO', '360_VIEW'],
    default: 'IMAGE',
  })
  type: string; // AC4 (Video), AC10 (360 độ)

  @Prop()
  thumbnail?: string; // AC1: Thumbnail cho video

  @Prop()
  alt?: string; // AC12: SEO Text

  @Prop()
  color?: string; // AC6: Mapping màu sắc (VD: "Đỏ")

  @Prop({ default: 0 })
  display_order: number;

  // [BỔ SUNG] Thêm trường này để khớp với kết quả từ Controller upload
  @Prop()
  medium?: string;
}

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

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  requester_id: Types.ObjectId;

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

  //Lưu danh sách các slug cũ để Redirect 301
  @Prop({ type: [String], default: [], index: true })
  old_slugs: string[];

  @Prop({ default: 0 })
  soldCount: number; // Để tính badge Best Seller

  @Prop()
  metaTitle: string; // AC14: Advanced SEO

  @Prop()
  metaDescription: string; // AC14: Advanced SEO

  // AC1: Giá khuyến mãi & Gốc
  @Prop()
  originalPrice: number;

  @Prop()
  salePrice: number;

  @Prop({ type: Date })
  saleEndDate: Date;

  @Prop({ type: String })
  description: string;

  @Prop({ default: '' })
  short_description: string;

  @Prop()
  brand: string;

  @Prop({ type: [ProductMedia], default: [] }) // Bỏ Mixed, dùng Schema class trực tiếp
  gallery: ProductMedia[];

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop()
  video: string;

  @Prop({ default: null })
  max_purchase_qty?: number;

  @Prop({ default: 1 })
  min_purchase_qty: number;

  @Prop({ default: false })
  is_member_only: boolean; // AC14: Chỉ dành cho thành viên

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

  @Prop()
  thumbnail: string;

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

  @Prop({ default: 0 })
  rating_average: number;

  @Prop({ default: 0 })
  review_count: number;

  // Trường lưu dữ liệu chờ duyệt giá
  @Prop({ type: PendingPriceChange, default: null })
  pending_price_change: PendingPriceChange | null;

  @Prop({ default: false, index: true })
  is_deleted: boolean;

  @Prop({ default: null })
  deleted_at: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

//Tinh chỉnh logic hiển thị Badge
ProductSchema.virtual('badges').get(function (this: Product) {
  const badges: { type: string; label: string }[] = [];

  // 1. Badge Hết hàng
  if (this.stock <= 0) {
    badges.push({ type: 'OUT_OF_STOCK', label: 'Hết hàng' });
    return badges; // Ưu tiên cao nhất
  }

  // 2. Badge New (Sản phẩm tạo trong vòng 7 ngày)
  const isNew =
    new Date().getTime() - (this['created_at']?.getTime() || 0) <
    7 * 24 * 60 * 60 * 1000;
  if (isNew) badges.push({ type: 'NEW', label: 'Mới' });

  // 3. Badge Sale -XX%
  if (this.sale_price > 0 && this.sale_price < this.price) {
    // Kiểm tra ngày hiệu lực sale
    const now = new Date();
    if (
      !this.sale_start_date ||
      !this.sale_end_date ||
      (now >= this.sale_start_date && now <= this.sale_end_date)
    ) {
      //Sử dụng Math.floor để làm tròn xuống và chặn trần 99%
      let percent = Math.floor(
        ((this.price - this.sale_price) / this.price) * 100,
      );

      // Nếu tính ra 100% (do làm tròn) nhưng giá vẫn > 0 -> set cứng 99%
      if (percent >= 100 && this.sale_price > 0) {
        percent = 99;
      }

      // Chỉ hiện badge nếu giảm giá ít nhất 1%
      if (percent > 0) {
        badges.push({ type: 'SALE', label: `-${percent}%` });
      }
    }
  }

  // 4. Badge Best Seller (Ví dụ bán > 1000 cái)
  if (this.sold_count > 1000)
    badges.push({ type: 'BEST_SELLER', label: 'Bán chạy' });

  return badges;
});

ProductSchema.virtual('current_active_price').get(function (this: Product) {
  // Trường hợp 1: Có ngày cụ thể
  const now = new Date();
  if (this.sale_price > 0 && this.sale_start_date && this.sale_end_date) {
    if (now >= this.sale_start_date && now <= this.sale_end_date) {
      return this.sale_price;
    }
    return this.price; // Hết hạn sale
  }

  // Trường hợp 2: Không set ngày -> Sale vĩnh viễn (FIX)
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
