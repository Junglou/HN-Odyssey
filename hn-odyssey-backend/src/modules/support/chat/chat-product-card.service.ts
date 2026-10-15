import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import { ProductStatus } from 'src/common/enums/product-status.enum';

const MAX_CARDS = 3;

// Nhãn cho các mã thuộc tính hay gặp; mã lạ thì hiển thị nguyên mã
const OPTION_LABELS: Record<string, string> = {
  color: 'Màu sắc',
  colour: 'Màu sắc',
  size: 'Kích cỡ',
  capacity: 'Dung tích',
  material: 'Chất liệu',
  condition: 'Tình trạng',
};

export interface ChatCardVariant {
  sku: string;
  price: number;
  original_price: number;
  stock: number;
  image?: string;
  attributes: { code: string; value: string }[];
}

export interface ChatCardOption {
  code: string;
  label: string;
  values: string[];
}

export interface ChatProductCard {
  product_id: string;
  name: string;
  slug: string;
  image: string;
  currency: string;
  price: number; // Giá thấp nhất đang bán
  original_price: number;
  has_variants: boolean;
  sku?: string; // Chỉ có với sản phẩm KHÔNG phân loại
  stock: number;
  min_qty: number;
  options: ChatCardOption[];
  variants: ChatCardVariant[];
}

interface LeanVariant {
  sku: string;
  price?: number;
  sale_price?: number;
  stock?: number;
  images?: string[];
  active?: boolean;
  attributes?: { code: string; value: string }[];
}

interface LeanProduct {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  sku: string;
  thumbnail?: string;
  images?: string[];
  currency?: string;
  price?: number;
  sale_price?: number;
  stock?: number;
  has_variants?: boolean;
  variants?: LeanVariant[];
  min_purchase_qty?: number;
  allowed_tiers?: string[];
}

@Injectable()
export class ChatProductCardService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  // Nhận product_ids do AI trả về -> trả về tối đa 3 thẻ hợp lệ, đúng thứ tự AI gợi ý
  async buildCards(rawIds: unknown): Promise<ChatProductCard[]> {
    if (!Array.isArray(rawIds)) return [];

    const ids = Array.from(new Set(rawIds.map((id) => String(id).trim())))
      .filter((id) => Types.ObjectId.isValid(id))
      .slice(0, MAX_CARDS);

    if (ids.length === 0) return [];

    const products = await this.productModel
      .find({
        _id: { $in: ids },
        status: ProductStatus.ACTIVE,
        is_deleted: false,
      })
      .select(
        'name slug sku thumbnail images currency price sale_price stock has_variants variants min_purchase_qty allowed_tiers',
      )
      .lean<LeanProduct[]>()
      .exec();

    const byId = new Map(products.map((p) => [String(p._id), p]));
    const cards: ChatProductCard[] = [];

    for (const id of ids) {
      const product = byId.get(id);
      if (!product) continue; // AI đưa id sai / sản phẩm đã ngừng bán -> bỏ qua
      // Quà độc quyền theo hạng thành viên không bán thường -> không gợi ý
      if (product.allowed_tiers && product.allowed_tiers.length > 0) continue;

      const card = this.toCard(product);
      if (card) cards.push(card);
    }

    return cards;
  }

  private toCard(p: LeanProduct): ChatProductCard | null {
    const base = {
      product_id: String(p._id),
      name: p.name,
      slug: p.slug,
      image: p.thumbnail || p.images?.[0] || '',
      currency: p.currency || 'USD',
      min_qty: Math.max(1, p.min_purchase_qty || 1),
    };

    // Sản phẩm đơn: cùng quy tắc giá với luồng tạo đơn (sale_price > 0 thì dùng sale_price)
    if (!p.has_variants) {
      const original = p.price ?? 0;
      const salePrice = p.sale_price ?? 0;
      const price = salePrice > 0 ? salePrice : original;
      if (price <= 0) return null;

      return {
        ...base,
        price,
        original_price: original,
        has_variants: false,
        sku: p.sku,
        stock: p.stock ?? 0,
        options: [],
        variants: [],
      };
    }

    // Sản phẩm có phân loại: chỉ lấy phân loại đang bán (đã duyệt giá)
    const variants: ChatCardVariant[] = (p.variants ?? [])
      .filter((v) => v.active !== false && (v.price ?? 0) > 0)
      .map((v) => {
        const original = v.price ?? 0;
        const salePrice = v.sale_price ?? 0;
        return {
          sku: v.sku,
          price: salePrice > 0 ? salePrice : original,
          original_price: original,
          stock: v.stock ?? 0,
          image: v.images?.[0],
          attributes: (v.attributes ?? []).map((a) => ({
            code: a.code,
            value: a.value,
          })),
        };
      });

    if (variants.length === 0) return null;

    // Gom các nhóm lựa chọn (Màu, Size...) từ phân loại đang bán
    const optionMap = new Map<string, string[]>();
    for (const variant of variants) {
      for (const attr of variant.attributes) {
        const values = optionMap.get(attr.code) ?? [];
        if (!values.includes(attr.value)) values.push(attr.value);
        optionMap.set(attr.code, values);
      }
    }

    const options: ChatCardOption[] = Array.from(optionMap.entries()).map(
      ([code, values]) => ({
        code,
        label:
          OPTION_LABELS[code.toLowerCase()] ||
          code.charAt(0).toUpperCase() + code.slice(1),
        values,
      }),
    );

    const cheapest = variants.reduce(
      (min, v) => (v.price < min.price ? v : min),
      variants[0],
    );

    return {
      ...base,
      price: cheapest.price,
      original_price: cheapest.original_price,
      has_variants: true,
      stock: variants.reduce((sum, v) => sum + v.stock, 0),
      options,
      variants,
    };
  }
}
