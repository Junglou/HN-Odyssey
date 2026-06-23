import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import { AssociationRuleService } from './association-rule.service';
import { PersonalizedService } from './personalized.service';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { OnEvent } from '@nestjs/event-emitter';

// Thêm interface để trả về dữ liệu chuẩn cho Admin Dashboard
export interface IReplenishmentCandidate {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  product_id: string;
  product_name: string;
  last_purchased_at: Date;
  estimated_expiry: Date;
}

// Thêm interface này phía trên class
interface IPopulatedUser {
  _id: Types.ObjectId;
  fullName?: string;
  email: string;
}

@Injectable()
export class PurchaseBasedService {
  private readonly logger = new Logger(PurchaseBasedService.name);
  private readonly EXCLUDED_STATUSES = [
    'CANCELLED',
    'RETURNED',
    'REFUNDED',
    'DELIVERY_FAILED',
  ];

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly fbtService: AssociationRuleService,
    private readonly personalizedService: PersonalizedService, // Dùng cho AC6 (Fallback)
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getReplenishmentCandidates(): Promise<IReplenishmentCandidate[]> {
    const candidates: IReplenishmentCandidate[] = [];
    const now = new Date();
    const cycleDays = 45;
    const startTarget = new Date(
      now.getTime() - cycleDays * 24 * 60 * 60 * 1000,
    );
    const endTarget = new Date(
      now.getTime() - (cycleDays - 5) * 24 * 60 * 60 * 1000,
    );

    const orders = await this.orderModel
      .find({
        status: 'DELIVERED',
        createdAt: { $gte: startTarget, $lte: endTarget },
      })
      .populate('user_id', 'fullName email')
      .lean();

    for (const order of orders) {
      // 1. Ép kiểu an toàn bằng unknown -> IPopulatedUser TRƯỚC khi check
      const user = order.user_id as unknown as IPopulatedUser;

      // 2. Check an toàn hoàn toàn không dùng any, ESLint sẽ pass 100%
      if (!user || !user._id || !order.createdAt) continue;

      for (const item of order.items) {
        const product = await this.productModel
          .findOne({
            _id: item.product_id,
            tags: { $in: ['fmcg', 'tieu-dung', 'gas', 'thuc-pham'] },
          })
          .select('name')
          .lean();

        if (product) {
          const hasRepurchased = await this.orderModel.exists({
            user_id: user._id,
            'items.product_id': item.product_id,
            createdAt: { $gt: order.createdAt },
          });

          if (!hasRepurchased) {
            candidates.push({
              customer_id: user._id.toString(),
              customer_name: user.fullName || 'Khách hàng',
              customer_email: user.email,
              product_id: product._id.toString(),
              product_name: product.name,
              last_purchased_at: order.createdAt,
              estimated_expiry: new Date(
                order.createdAt.getTime() + cycleDays * 24 * 60 * 60 * 1000,
              ),
            });
          }
        }
      }
    }
    return candidates;
  }

  // AC1, AC3, AC4, AC8, AC9: Core Logic cho Gợi ý Mua lại & Phụ kiện
  async getReorderAndAccessories(
    userId: string,
    limit: number = 10,
  ): Promise<ProductDocument[]> {
    const cacheKey = `purchase_recs_${userId}`;
    try {
      // [FIX US2-AC14]: Kiểm tra Cache trước (6 tiếng)
      const cachedData =
        await this.cacheManager.get<ProductDocument[]>(cacheKey);
      if (cachedData && cachedData.length > 0) return cachedData;

      // 1. Lấy lịch sử mua hàng hợp lệ (Bao gồm cả AC3: Trọng số Recency - Ưu tiên mới nhất)
      const orders = await this.orderModel
        .find({
          user_id: new Types.ObjectId(userId),
          status: { $nin: this.EXCLUDED_STATUSES }, // AC9: Xử lý Đổi trả
        })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('items.product_id createdAt')
        .lean();

      const purchasedProductIds = [
        ...new Set(
          orders.flatMap((o) => o.items.map((i) => i.product_id.toString())),
        ),
      ];

      // AC6: Cold Start (Data mỏng) - Nếu chưa mua đủ 2 đơn/sản phẩm -> Fallback sang View-based (Just For You)
      if (purchasedProductIds.length < 2) {
        const fallback = await this.personalizedService.getJustForYouWidget(
          userId,
          userId,
          limit,
        );
        // [FIX 1]: Ép kiểu qua unknown để khớp với Document Type sau khi lấy từ Widget
        return fallback.products as unknown as ProductDocument[];
      }

      // Lấy chi tiết các sản phẩm đã mua để phân loại (AC1)
      const purchasedProducts = await this.productModel
        .find({
          _id: { $in: purchasedProductIds.map((id) => new Types.ObjectId(id)) },
        })
        .select('tags categories name')
        .lean();

      const fmcgProductIds: Types.ObjectId[] = [];
      const durableProductIds: string[] = [];

      const recommendationIds = new Set<string>();

      const now = Date.now();
      const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

      for (const p of purchasedProducts) {
        const isFMCG = p.tags?.some((tag) =>
          ['fmcg', 'tieu-dung', 'gas', 'thuc-pham'].includes(tag.toLowerCase()),
        );

        if (isFMCG) {
          // TÌM NGÀY MUA SẢN PHẨM NÀY GẦN NHẤT
          const orderOfProduct = orders.find((o) =>
            o.items.some((i) => i.product_id.toString() === p._id.toString()),
          );

          // [FIX 3]: Kiểm tra orderOfProduct.createdAt có tồn tại không trước khi truyền vào new Date()
          if (orderOfProduct && orderOfProduct.createdAt) {
            const timeSincePurchase =
              now - new Date(orderOfProduct.createdAt).getTime();
            // [CHUẨN AC4]: Chỉ gợi ý mua lại nếu đã mua qua 30 ngày (tùy chỉnh chu kỳ tại đây)
            if (timeSincePurchase >= THIRTY_DAYS_IN_MS) {
              recommendationIds.add(p._id.toString());
            }
          }
        } else {
          durableProductIds.push(p._id.toString());
        }
      }

      // AC1 & AC4: Hàng tiêu dùng (FMCG) -> Gợi ý MUA LẠI
      if (fmcgProductIds.length > 0) {
        fmcgProductIds.forEach((id) => recommendationIds.add(id.toString()));
      }

      // AC1 & AC2 & AC5: Hàng bền (Durable) -> Gợi ý PHỤ KIỆN (Cross-sell / Association Rules)
      for (const dId of durableProductIds) {
        // Tận dụng AssociationRuleService đã có để quét phụ kiện tương thích
        const accessories = await this.fbtService.getFrequentlyBoughtTogether(
          dId,
          3,
        );
        accessories.forEach((acc) => {
          // AC8: Chặn mua lại hàng bền (Không gợi ý chính sản phẩm gốc)
          if (!durableProductIds.includes(acc.product._id.toString())) {
            recommendationIds.add(acc.product._id.toString());
          }
        });
      }

      // Truy vấn Database lấy chi tiết, áp dụng AC7 (Ưu tiên khuyến mãi)
      const finalProducts = (await this.productModel
        .find({
          _id: {
            $in: Array.from(recommendationIds).map(
              (id) => new Types.ObjectId(id),
            ),
          },
          status: ProductStatus.ACTIVE,
          is_deleted: false,
          stock: { $gt: 0 },
        })
        // AC7: Ưu tiên Khuyến mãi (is_flash_sale -> sale_price nhỏ hơn price)
        .sort({ is_flash_sale: -1, sale_price: 1 })
        .limit(limit)
        .lean()) as unknown as ProductDocument[];

      // Nếu vẫn ít quá sau khi lọc, đắp thêm Fallback
      let resultToCache = finalProducts;

      if (finalProducts.length < limit) {
        const supplement = await this.personalizedService.getTrendingItems(
          limit - finalProducts.length,
        );
        resultToCache = [
          ...finalProducts,
          // [FIX 5]: Ép kiểu cho supplement.products
          ...(supplement.products as unknown as ProductDocument[]),
        ];
      }

      if (resultToCache.length > 0) {
        await this.cacheManager.set(cacheKey, resultToCache, 21600000);
      }

      return resultToCache;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Lỗi getReorderAndAccessories: ${errorMessage}`);
      return [];
    }
  }

  // [FIX US2-AC14]: Xóa Cache khi khách có đơn hàng mới (tương tự CF Service)
  @OnEvent('order.created')
  async handleNewOrderClearPurchaseCache(payload: {
    user_id?: Types.ObjectId | string;
  }) {
    if (payload.user_id) {
      await this.cacheManager.del(`purchase_recs_${String(payload.user_id)}`);
    }
  }
}
