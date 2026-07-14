import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { MlIntegrationService } from './ml-integration.service';
import { PersonalizedService } from './personalized.service';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { OnEvent } from '@nestjs/event-emitter';
import {
  UserBehavior,
  BehaviorAction,
} from 'src/modules/recommendations/tracking/schemas/user-behavior.schema';

interface IReviewRecord {
  metadata?: {
    product_id?: string;
  };
}

interface ICategoriesRecord {
  slug: string;
}

@Injectable()
export class CollaborativeFilteringService {
  private readonly logger = new Logger(CollaborativeFilteringService.name);

  private readonly SENSITIVE_CATEGORIES = [
    'do-lot',
    'dao-sinh-ton',
    'gas-cam-trai',
  ];

  constructor(
    private readonly mlEngine: MlIntegrationService,
    private readonly personalizedService: PersonalizedService,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(UserBehavior.name) private behaviorModel: Model<UserBehavior>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getCollaborativeRecommendations(
    userId: string,
    limit: number = 10,
  ): Promise<ProductDocument[]> {
    const cacheKey = `cf_recs_${userId}`;

    try {
      const cachedRecs =
        await this.cacheManager.get<ProductDocument[]>(cacheKey);
      if (cachedRecs && cachedRecs.length > 0) {
        return cachedRecs;
      }

      const aiSuggestedIds = await this.mlEngine.getAiRecommendations(userId);

      if (!aiSuggestedIds || aiSuggestedIds.length < 1) {
        this.logger.log(
          `Cold start / Thiếu Neighbor cho User ${userId}. Fallback to Trending.`,
        );
        const fallback = await this.personalizedService.getTrendingItems(limit);
        return fallback.products as ProductDocument[];
      }

      const userOrders = await this.orderModel
        .find({ user_id: new Types.ObjectId(userId) })
        .select('items.product_id')
        .lean();

      const boughtIds = userOrders.flatMap((o) =>
        o.items.map((i) => String(i.product_id)),
      );

      // Lọc bỏ các string không hợp lệ trước khi parse sang ObjectId để chống crash
      const validObjectIds = aiSuggestedIds
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));

      const validProducts = await this.productModel
        .find({
          _id: { $in: validObjectIds },
          // Chấp nhận cả 2 trường hợp: DB dùng 'active: true' HOẶC 'status: ACTIVE'
          $or: [
            { active: true },
            {
              status: { $regex: new RegExp(`^${ProductStatus.ACTIVE}$`, 'i') },
            },
          ],
          is_deleted: { $ne: true },
          stock: { $gt: 0 },
        })
        .populate('categories', 'slug')
        .lean();

      const finalProducts: ProductDocument[] = [];

      const badReviews = (await this.behaviorModel
        .find({
          user_id: new Types.ObjectId(userId),
          action: BehaviorAction.REVIEW_PRODUCT, // Gọi trực tiếp enum chuẩn
          'metadata.rating': { $lte: 2 },
        })
        .select('metadata.product_id')
        .lean()) as IReviewRecord[];

      // Sử dụng Type Guard để lọc mảng string an toàn
      const dislikedIds = badReviews
        .map((r) => r.metadata?.product_id)
        .filter((id): id is string => typeof id === 'string');

      for (const p of validProducts) {
        // Đảm bảo kiểu dữ liệu khi duyệt qua categories
        const docCats = (p.categories || []) as unknown as ICategoriesRecord[];
        const pIdStr = String(p._id);

        if (boughtIds.includes(pIdStr) || dislikedIds.includes(pIdStr)) {
          continue;
        }

        const impCount =
          (await this.cacheManager.get<number>(
            `impression:${userId}:${pIdStr}`,
          )) || 0;
        if (impCount >= 3) continue;

        const isSensitive = docCats.some((c) =>
          this.SENSITIVE_CATEGORIES.includes(c.slug),
        );
        if (isSensitive) continue;

        finalProducts.push(p as unknown as ProductDocument);
        if (finalProducts.length >= limit) break;
      }

      finalProducts.sort((a, b) => {
        const aBoost = a.is_flash_sale ? 1 : 0;
        const bBoost = b.is_flash_sale ? 1 : 0;
        return bBoost - aBoost;
      });

      await this.cacheManager.set(cacheKey, finalProducts, 14400000);

      return finalProducts;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Lỗi CF Recommendation: ${msg}`);
      const safeFallback =
        await this.personalizedService.getTrendingItems(limit);
      return safeFallback.products as ProductDocument[];
    }
  }

  @OnEvent('order.created')
  async handleNewOrderClearCache(payload: {
    user_id?: Types.ObjectId | string;
  }) {
    if (payload.user_id) {
      // Sử dụng hàm String() thay vì gọi .toString() trực tiếp trên union type
      const userIdStr = String(payload.user_id);
      const cacheKey = `cf_recs_${userIdStr}`;
      await this.cacheManager.del(cacheKey);
      this.logger.log(
        `[CF Cache] Đã xóa cache gợi ý của User ${userIdStr} do phát sinh đơn hàng mới.`,
      );
    }
  }
}
