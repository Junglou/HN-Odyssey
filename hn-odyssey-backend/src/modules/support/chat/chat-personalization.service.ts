import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation } from './schemas/conversation.schema';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { MlIntegrationService } from 'src/modules/recommendations/engine/ml-integration.service';
import { CollaborativeFilteringService } from 'src/modules/recommendations/engine/collaborative-filtering.service';
import { PersonalizedService } from 'src/modules/recommendations/engine/personalized.service';
import { VoucherRecommendationService } from 'src/modules/marketing/promotions/voucher-recommendation.service';
import { DiscountType } from 'src/modules/marketing/promotions/schemas/coupon.schema';

const MAX_PRODUCTS = 6; // Đưa dư cho AI chọn tối đa 3 thẻ
const MAX_VOUCHERS = 5;

export interface ChatbotProductItem {
  id: string;
  name: string;
  price_from_usd: number;
  in_stock: boolean;
}

export interface ChatbotRecommendationResult {
  personalized: boolean;
  source: 'ML_COLLABORATIVE' | 'TRENDING';
  note: string;
  products: ChatbotProductItem[];
}

export interface ChatbotVoucherResult {
  logged_in: boolean;
  vouchers: {
    code: string;
    discount: string;
    min_order_usd: number;
    expires_at: string | null;
    tags: string[];
  }[];
}

interface PriceSource {
  price?: number;
  sale_price?: number;
}

interface LeanSellable extends PriceSource {
  _id: Types.ObjectId | string;
  name: string;
  stock?: number;
  has_variants?: boolean;
  variants?: (PriceSource & { stock?: number; active?: boolean })[];
}

// Cùng quy tắc giá với luồng tạo đơn: sale_price > 0 thì dùng sale_price
const effectivePrice = (item: PriceSource): number => {
  const sale = item.sale_price ?? 0;
  return sale > 0 ? sale : (item.price ?? 0);
};

@Injectable()
export class ChatPersonalizationService {
  private readonly logger = new Logger(ChatPersonalizationService.name);

  constructor(
    @InjectModel(Conversation.name)
    private readonly convModel: Model<Conversation>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly mlEngine: MlIntegrationService,
    private readonly cfService: CollaborativeFilteringService,
    private readonly personalizedService: PersonalizedService,
    private readonly voucherService: VoucherRecommendationService,
  ) {}

  // AI chỉ đưa sessionId (= conversationId). Server tự tra ra khách -> AI không thể xin dữ liệu của người khác
  private async getCustomerId(sessionId: string): Promise<string | undefined> {
    if (!Types.ObjectId.isValid(sessionId)) return undefined;
    const conv = await this.convModel
      .findById(sessionId)
      .select('customer_id')
      .lean()
      .exec();
    return conv?.customer_id ? String(conv.customer_id) : undefined;
  }

  // TOOL 1: Gợi ý cá nhân hóa
  async recommendForCustomer(
    sessionId: string,
  ): Promise<ChatbotRecommendationResult> {
    const customerId = await this.getCustomerId(sessionId);

    if (customerId) {
      try {
        // ML Engine (SVD) có dữ liệu về khách này không? Rỗng = khách mới / model chưa sẵn sàng
        const aiIds = await this.mlEngine.getAiRecommendations(customerId);
        if (aiIds.length > 0) {
          const products = await this.cfService.getCollaborativeRecommendations(
            customerId,
            MAX_PRODUCTS,
          );
          const items = this.toItems(products as unknown as LeanSellable[]);
          if (items.length > 0) {
            return {
              personalized: true,
              source: 'ML_COLLABORATIVE',
              note: 'Gợi ý từ mô hình học máy dựa trên lịch sử xem, thêm giỏ và mua hàng của chính khách này.',
              products: items,
            };
          }
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Gợi ý cá nhân hóa lỗi, dùng hàng thịnh hành: ${msg}`);
      }
    }

    return {
      personalized: false,
      source: 'TRENDING',
      note: customerId
        ? 'Chưa đủ dữ liệu hành vi của khách này, đây là sản phẩm đang được nhiều khách chọn.'
        : 'Khách chưa đăng nhập, đây là sản phẩm đang được nhiều khách chọn.',
      products: await this.getTrendingItems(),
    };
  }

  // TOOL 2: Voucher khách dùng được
  async vouchersForCustomer(sessionId: string): Promise<ChatbotVoucherResult> {
    const customerId = await this.getCustomerId(sessionId);
    const suggestions = await this.voucherService.getRecommendedVouchers(
      customerId,
      'HOME',
    );

    return {
      logged_in: !!customerId,
      vouchers: suggestions.slice(0, MAX_VOUCHERS).map((s) => ({
        code: s.coupon.code,
        discount:
          s.coupon.discount_type === DiscountType.PERCENTAGE
            ? `${s.coupon.discount_value}%`
            : `$${s.coupon.discount_value}`,
        min_order_usd: s.coupon.min_order_value ?? 0,
        expires_at: s.coupon.end_date
          ? new Date(s.coupon.end_date).toISOString().slice(0, 10)
          : null,
        tags: s.tags,
      })),
    };
  }

  private async getTrendingItems(): Promise<ChatbotProductItem[]> {
    const trending =
      await this.personalizedService.getTrendingItems(MAX_PRODUCTS);
    const items = this.toItems(trending.products as unknown as LeanSellable[]);
    if (items.length > 0) return items;

    // Algolia lỗi / chưa có dữ liệu -> lấy hàng bán chạy trong DB
    const bestSellers = await this.productModel
      .find({
        status: ProductStatus.ACTIVE,
        is_deleted: false,
        allowed_tiers: { $size: 0 },
      })
      .sort({ sold_count: -1, rating_average: -1 })
      .limit(MAX_PRODUCTS * 2)
      .select('name price sale_price stock has_variants variants')
      .lean<LeanSellable[]>()
      .exec();

    return this.toItems(bestSellers);
  }

  // Cùng định dạng với tool Tìm Kiếm Sản Phẩm -> AI xử lý giống nhau
  private toItems(products: LeanSellable[]): ChatbotProductItem[] {
    return products
      .map((p) => {
        let priceFrom = effectivePrice(p);
        let totalStock = p.stock ?? 0;

        if (p.has_variants && p.variants?.length) {
          const sellable = p.variants.filter(
            (v) => v.active !== false && (v.price ?? 0) > 0,
          );
          if (sellable.length > 0) {
            priceFrom = Math.min(...sellable.map(effectivePrice));
          }
          totalStock = sellable.reduce((sum, v) => sum + (v.stock ?? 0), 0);
        }

        return {
          id: String(p._id),
          name: p.name,
          price_from_usd: priceFrom,
          in_stock: totalStock > 0,
        };
      })
      .filter((item) => item.price_from_usd > 0)
      .slice(0, MAX_PRODUCTS);
  }
}
