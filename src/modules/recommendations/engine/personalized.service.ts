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

  // Khai báo kiểu dữ liệu tuyệt đối an toàn
  private recommendClient: IAlgoliaRecommendClient;
  private readonly indexName: string;

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private configService: ConfigService,
    @InjectModel('UserBehavior') private behaviorModel: Model<any>,
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
    let candidateIds: string[] = [];

    // Định nghĩa type cục bộ để TypeScript không coi kết quả query là 'any'
    interface IBehaviorRecord {
      metadata?: {
        product_id?: string;
      };
    }

    // Ưu tiên 1: Lấy ID sản phẩm dựa trên Lịch sử Xem / Giỏ hàng
    if (userId) {
      // Ép kiểu (Type Assertion) an toàn để thỏa mãn ESLint
      const recentViews = (await this.behaviorModel
        .find({
          user_id: new Types.ObjectId(userId),
          action: { $in: ['VIEW_PRODUCT', 'ADD_TO_CART'] },
        })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean()) as IBehaviorRecord[];

      if (recentViews.length > 0) {
        // Gọi Algolia Related dựa trên đồ vừa xem
        for (const v of recentViews) {
          const productId = v.metadata?.product_id;

          // Kiểm tra type rõ ràng trước khi truyền vào objectID của Algolia
          if (productId && typeof productId === 'string') {
            const recs = await this.recommendClient.getRelatedProducts([
              {
                indexName: this.indexName,
                objectID: productId, // Lúc này productId chắc chắn là string, hết báo đỏ
                maxRecommendations: 5,
              },
            ]);
            candidateIds.push(
              ...(recs.results[0]?.hits.map((h) => h.objectID) || []),
            );
          }
        }
      }
    }

    // Ưu tiên 3 & Fallback: Lấy Trending Items nếu chưa đủ data xem/mua (Cold Start)
    if (candidateIds.length < limit) {
      const trending = await this.recommendClient.getTrendingItems([
        { indexName: this.indexName, maxRecommendations: limit * 2 },
      ]);
      candidateIds.push(
        ...(trending.results[0]?.hits.map((h) => h.objectID) || []),
      );
    }

    // Lọc trùng lặp ID
    candidateIds = [...new Set(candidateIds)];

    // [FIX AC4 & AC5]: Lọc thông minh & Đa dạng hóa danh mục
    const validProducts = await this.productModel
      .find({
        _id: { $in: candidateIds.map((id) => new Types.ObjectId(id)) },
        status: 'ACTIVE',
        is_deleted: false,
        stock: { $gt: 0 }, // AC4: Bắt buộc còn hàng
        tags: { $nin: ['durable-goods'] }, // AC4: Lọc hàng bền (Lều cắm trại size lớn, Thùng đá giữ nhiệt Yeti, Thuyền Kayak)
      })
      .populate('categories', 'name slug')
      .lean();

    const finalProducts: ProductDocument[] = [];
    const categoryCountMap = new Map<string, number>();

    for (const p of validProducts) {
      const doc = p as unknown as ProductDocument;
      let pCategory = 'unknown';

      if (doc.categories && doc.categories.length > 0) {
        const firstCat = doc.categories[0];

        // Dùng Type Guard để TypeScript hiểu rõ cấu trúc, loại bỏ hoàn toàn 'any'
        if (firstCat instanceof Types.ObjectId) {
          pCategory = firstCat.toHexString();
        } else if (typeof firstCat === 'string') {
          pCategory = firstCat;
        } else if (
          firstCat &&
          typeof firstCat === 'object' &&
          '_id' in firstCat
        ) {
          pCategory = String((firstCat as { _id: unknown })._id);
        } else {
          // [FIX] Không gọi String(firstCat) để tránh lỗi no-base-to-string "[object Object]"
          pCategory = 'unknown';
        }
      }

      const count = categoryCountMap.get(pCategory) || 0;

      // AC5: Diversity Rule - Chỉ cho phép tối đa 3 sản phẩm cùng 1 danh mục hiển thị
      if (count < 3) {
        finalProducts.push(doc);
        categoryCountMap.set(pCategory, count + 1);
      }

      if (finalProducts.length >= limit) break;
    }

    return {
      title: 'Dành riêng cho bạn',
      type: 'JUST_FOR_YOU',
      products: finalProducts,
    };
  }
}
