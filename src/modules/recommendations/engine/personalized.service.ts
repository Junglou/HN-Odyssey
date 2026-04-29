import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';

import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import {
  IAlgoliaRecommendHit,
  IAlgoliaFacetHit,
  IRecommendationResult,
} from 'src/common/interfaces/algolia.interface';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';

// 1. ĐỊNH NGHĨA TYPE Ở CẤP ĐỘ GLOBAL (NGOÀI CLASS) ĐỂ TS LUÔN TÌM THẤY

interface IRecommendQuery {
  indexName: string;
  maxRecommendations?: number;
  facetName?: string;
  facetValue?: string;
  objectID?: string;
}

interface IRecommendResponse<T> {
  results: Array<{
    hits: T[];
  }>;
}

interface IAlgoliaRecommendClient {
  getTrendingItems(
    queries: IRecommendQuery[],
  ): Promise<IRecommendResponse<IAlgoliaRecommendHit>>;
  getTrendingFacets(
    queries: IRecommendQuery[],
  ): Promise<IRecommendResponse<IAlgoliaFacetHit>>;
  getRelatedProducts(
    queries: IRecommendQuery[],
  ): Promise<IRecommendResponse<IAlgoliaRecommendHit>>;
  getLookingSimilar(
    queries: IRecommendQuery[],
  ): Promise<IRecommendResponse<IAlgoliaRecommendHit>>;
}

@Injectable()
export class PersonalizedService {
  private readonly logger = new Logger(PersonalizedService.name);
  private recommendClient: IAlgoliaRecommendClient;
  private readonly indexName: string;

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private configService: ConfigService,
    @InjectModel('UserBehavior') private behaviorModel: Model<any>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {
    const appId = this.configService.get<string>('ALGOLIA_APP_ID') || '';
    const apiKey = this.configService.get<string>('ALGOLIA_ADMIN_KEY') || '';
    this.indexName =
      this.configService.get<string>('ALGOLIA_INDEX_NAME') || 'products';

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rawModule: unknown = require('@algolia/recommend');
    let finalClient: IAlgoliaRecommendClient | undefined;

    const tryInit = (fn: unknown): IAlgoliaRecommendClient | undefined => {
      if (typeof fn === 'function') {
        try {
          const factory = fn as (
            a: string,
            b: string,
          ) => Record<string, unknown>;
          const instance = factory(appId, apiKey);

          // Kiểm chứng: Phải có getTrendingItems mới nhận
          if (instance && typeof instance.getTrendingItems === 'function') {
            return instance as unknown as IAlgoliaRecommendClient;
          }
        } catch {
          return undefined;
        }
      }
      return undefined;
    };

    finalClient = tryInit(rawModule);
    if (!finalClient && rawModule !== null && typeof rawModule === 'object') {
      const obj = rawModule as Record<string, unknown>;
      finalClient =
        tryInit(obj.recommend) ||
        tryInit(obj.default) ||
        tryInit(obj.recommendClient);

      if (!finalClient && obj.default && typeof obj.default === 'object') {
        const nested = obj.default as Record<string, unknown>;
        finalClient = tryInit(nested.recommend) || tryInit(nested.default);
      }
    }

    if (!finalClient) {
      this.logger.error(
        'Khởi tạo thất bại: Không tìm thấy phương thức getTrendingItems trong module.',
      );
      throw new Error('Algolia Recommend Init Failure');
    }

    this.recommendClient = finalClient;
  }

  //  1. TRENDING ITEMS
  async getTrendingItems(
    limit: number = 10,
    facetName?: string,
    facetValue?: string,
  ): Promise<IRecommendationResult> {
    try {
      const response = await this.recommendClient.getTrendingItems([
        {
          indexName: this.indexName,
          maxRecommendations: limit,
          facetName: facetName,
          facetValue: facetValue,
        },
      ]);

      const hits = response.results[0]?.hits || [];
      const products = await this.fetchProductsFromHits(hits);

      return {
        title: 'Đang thịnh hành',
        type: 'TRENDING_ITEMS',
        products,
      };
    } catch (error) {
      this.logger.error(
        'Lỗi lấy Trending Items từ Algolia',
        error instanceof Error ? error.message : String(error),
      );
      return { title: '', type: 'ERROR', products: [] };
    }
  }

  //  2. TRENDING FACET VALUES
  async getTrendingFacets(facetName: string = 'categories'): Promise<string[]> {
    try {
      const response = await this.recommendClient.getTrendingFacets([
        {
          indexName: this.indexName,
          facetName: facetName,
          maxRecommendations: 5,
        },
      ]);

      const hits = response.results[0]?.hits || [];
      return hits.map((hit) => hit.facetValue);
    } catch (error) {
      this.logger.error(
        'Lỗi lấy Trending Facets',
        error instanceof Error ? error.message : String(error),
      );
      return [];
    }
  }

  //  3. RELATED ITEMS
  async getRelatedProducts(
    productId: string,
    limit: number = 10,
  ): Promise<IRecommendationResult> {
    try {
      const response = await this.recommendClient.getRelatedProducts([
        {
          indexName: this.indexName,
          objectID: productId,
          maxRecommendations: limit,
        },
      ]);

      const hits = response.results[0]?.hits || [];
      const products = await this.fetchProductsFromHits(hits);

      return {
        title: 'Khám phá thêm các lựa chọn thay thế',
        type: 'RELATED_ITEMS',
        products,
      };
    } catch (error) {
      this.logger.error(
        'Lỗi lấy Related Products',
        error instanceof Error ? error.message : String(error),
      );
      return { title: '', type: 'ERROR', products: [] };
    }
  }

  //  4. LOOKING SIMILAR
  async getLookingSimilar(
    productId: string,
    limit: number = 10,
  ): Promise<IRecommendationResult> {
    try {
      const response = await this.recommendClient.getLookingSimilar([
        {
          indexName: this.indexName,
          objectID: productId,
          maxRecommendations: limit,
        },
      ]);

      const hits = response.results[0]?.hits || [];
      const products = await this.fetchProductsFromHits(hits);

      return {
        title: 'Sản phẩm tương tự',
        type: 'LOOKING_SIMILAR',
        products,
      };
    } catch (error) {
      this.logger.error(
        'Lỗi lấy Looking Similar',
        error instanceof Error ? error.message : String(error),
      );
      return { title: '', type: 'ERROR', products: [] };
    }
  }

  //  HÀM HELPER QUERY DB
  private async fetchProductsFromHits(
    hits: IAlgoliaRecommendHit[],
  ): Promise<ProductDocument[]> {
    if (!hits || hits.length === 0) return [];

    const ids = hits.map((hit) => new Types.ObjectId(hit.objectID));

    const products = await this.productModel
      .find({
        _id: { $in: ids },
        status: 'ACTIVE',
        is_deleted: false,
      })
      .select('-__v')
      .lean();

    const productsMap = new Map<string, ProductDocument>();
    products.forEach((p) =>
      productsMap.set(p._id.toString(), p as unknown as ProductDocument),
    );

    const sortedProducts: ProductDocument[] = [];
    for (const hit of hits) {
      const p = productsMap.get(hit.objectID);
      if (p) sortedProducts.push(p);
    }

    return sortedProducts;
  }

  //  [FIX AC1, AC4, AC5]: THUẬT TOÁN JUST FOR YOU
  async getJustForYouWidget(
    sessionId: string,
    userId?: string,
    limit: number = 10,
  ): Promise<IRecommendationResult> {
    try {
      let candidateIds: string[] = [];
      let boughtIds: string[] = [];
      const priceRange = { min: 0, max: Infinity };

      interface IBehaviorRecord {
        metadata?: { product_id?: string };
      }

      if (userId && Types.ObjectId.isValid(userId)) {
        // [FIX AC7]: Lấy danh sách ID sản phẩm khách đã mua để khử trùng
        const orders = await this.orderModel
          .find({
            user_id: new Types.ObjectId(userId),
            status: { $nin: ['CANCELLED', 'RETURNED', 'REFUNDED'] },
          })
          .select('items.product_id')
          .lean();

        // CHỐNG CRASH: Sử dụng fallback (o.items || []) để phòng hờ mảng items bị undefined
        boughtIds = orders.flatMap((o) =>
          (o.items || []).map((i) => String(i.product_id)),
        );

        // Ưu tiên 1: Lấy ID sản phẩm dựa trên Lịch sử Xem / Giỏ hàng
        const recentViews = (await this.behaviorModel
          .find({
            user_id: new Types.ObjectId(userId),
            action: { $in: ['VIEW_PRODUCT', 'ADD_TO_CART'] },
          })
          .sort({ createdAt: -1 })
          .limit(3)
          .lean()) as IBehaviorRecord[];

        if (recentViews.length > 0) {
          // [FIX AC3]: Tính toán khoảng giá tương đồng (+/- 20%) từ sản phẩm vừa xem
          const viewedIds = recentViews
            .map((v) => v.metadata?.product_id)
            .filter(
              (id): id is string =>
                typeof id === 'string' && Types.ObjectId.isValid(id),
            ); // Lọc cực chuẩn

          if (viewedIds.length > 0) {
            const viewedProducts = await this.productModel
              .find({
                _id: { $in: viewedIds.map((id) => new Types.ObjectId(id)) },
              })
              .select('price sale_price')
              .lean();

            if (viewedProducts.length > 0) {
              // [FIX ESLINT]: Ép kiểu qua unknown rồi định nghĩa cấu trúc an toàn thay vì dùng 'any'
              const prices = viewedProducts.map((p) => {
                const doc = p as unknown as {
                  sale_price: number;
                  price: number;
                };
                return doc.sale_price > 0 ? doc.sale_price : doc.price;
              });

              const avgPrice =
                prices.reduce((a, b) => a + b, 0) / prices.length;
              priceRange.min = avgPrice * 0.8; // Trừ 20%
              priceRange.max = avgPrice * 1.2; // Cộng 20%
            }
          }

          // Gọi Algolia Related
          for (const v of recentViews) {
            const productId = v.metadata?.product_id;
            if (productId && typeof productId === 'string') {
              try {
                // Bọc try catch nhỏ để lỗi của 1 SP Algolia không làm chết cả vòng lặp
                const recs = await this.recommendClient.getRelatedProducts([
                  {
                    indexName: this.indexName,
                    objectID: productId,
                    maxRecommendations: limit,
                  },
                ]);
                candidateIds.push(
                  ...(recs.results[0]?.hits.map((h) => h.objectID) || []),
                );
              } catch (algoliaErr) {
                this.logger.warn(
                  `Algolia getRelatedProducts lỗi bỏ qua: ${algoliaErr}`,
                );
              }
            }
          }
        }
      }

      if (candidateIds.length < limit) {
        try {
          const trending = await this.recommendClient.getTrendingItems([
            { indexName: this.indexName, maxRecommendations: limit * 2 },
          ]);
          candidateIds.push(
            ...(trending.results[0]?.hits.map((h) => h.objectID) || []),
          );
        } catch (algoliaErr) {
          this.logger.warn(
            `Algolia getTrendingItems lỗi bỏ qua: ${algoliaErr}`,
          );
        }
      }

      candidateIds = [...new Set(candidateIds)];

      // [CHỐNG CRASH 500 NGHIÊM TRỌNG]: Bắt buộc phải check .isValid(id) trước khi chạy new Types.ObjectId(id)
      const validCandidateObjectIds = candidateIds
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));

      const validBoughtObjectIds = boughtIds
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));

      // [FIX AC3 & AC4 & AC5 & AC7]: Thiết lập bộ lọc Database Query
      const matchQuery: Record<string, any> = {
        _id: {
          $in: validCandidateObjectIds,
          $nin: validBoughtObjectIds, // AC7: Chặn gợi ý đồ đã mua
        },
        status: 'ACTIVE',
        is_deleted: false,
        stock: { $gt: 0 },
        tags: { $nin: ['durable-goods'] },
      };

      // AC3: Áp dụng ràng buộc giá (+/- 20%)
      if (priceRange.min > 0 && priceRange.max < Infinity) {
        matchQuery.$or = [
          { sale_price: { $gte: priceRange.min, $lte: priceRange.max } },
          { price: { $gte: priceRange.min, $lte: priceRange.max } },
        ];
      }

      const validProducts = await this.productModel
        .find(matchQuery)
        .populate('categories', 'name slug')
        .lean();

      const finalProducts: ProductDocument[] = [];
      const categoryCountMap = new Map<string, number>();

      for (const p of validProducts) {
        const doc = p as unknown as ProductDocument;
        let pCategory = 'unknown';

        if (doc.categories && doc.categories.length > 0) {
          const firstCat = doc.categories[0];
          if (firstCat instanceof Types.ObjectId)
            pCategory = firstCat.toHexString();
          else if (typeof firstCat === 'string') pCategory = firstCat;
          else if (
            firstCat &&
            typeof firstCat === 'object' &&
            '_id' in firstCat
          ) {
            pCategory = String((firstCat as { _id: unknown })._id);
          }
        }

        const count = categoryCountMap.get(pCategory) || 0;

        // Diversity: Không gợi ý quá 3 sản phẩm trùng Category
        if (count < 3) {
          finalProducts.push(doc);
          categoryCountMap.set(pCategory, count + 1);
        }

        if (finalProducts.length >= limit) break;
      }

      // Cơ chế an toàn 1: Đắp thêm bằng đồ Trending nếu list bị thiếu sau khi lọc giá
      if (finalProducts.length < limit) {
        const excludedIds = [
          ...validBoughtObjectIds,
          ...finalProducts.map((p) => p._id),
        ];

        const trendingFallback = await this.productModel
          .find({
            _id: { $nin: excludedIds },
            status: 'ACTIVE',
            is_deleted: false,
            stock: { $gt: 0 },
            tags: { $in: ['Trending', 'trending'] },
          })
          .limit(limit - finalProducts.length)
          .populate('categories', 'name slug')
          .lean();

        finalProducts.push(
          ...(trendingFallback as unknown as ProductDocument[]),
        );
      }

      return {
        title: 'Dành riêng cho bạn',
        type: 'JUST_FOR_YOU',
        products: finalProducts,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // [FIX AC8]: Cơ chế Fallback tối thượng. Không bao giờ quăng lỗi 500 ra Front-End.
      this.logger.error(
        `Lỗi hệ thống tại getJustForYouWidget: ${errorMessage}`,
      );

      const fallback = await this.productModel
        .find({
          status: 'ACTIVE',
          is_deleted: false,
          stock: { $gt: 0 },
          tags: { $in: ['Trending', 'trending'] },
        })
        .limit(limit)
        .populate('categories', 'name slug')
        .lean();

      return {
        title: 'Dành riêng cho bạn',
        type: 'JUST_FOR_YOU',
        products: fallback as unknown as ProductDocument[],
      };
    }
  }
}
