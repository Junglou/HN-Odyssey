import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import { IFBTRecommendation } from 'src/common/interfaces/recommendation.interface';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { ConfigService } from '@nestjs/config';

interface SafeProductData {
  price?: number;
}

interface IAlgoliaRecommendHit {
  objectID: string;
  _score?: number;
}

interface IAlgoliaFBTQuery {
  indexName: string;
  objectID: string;
  maxRecommendations?: number;
  queryParameters?: {
    clickAnalytics?: boolean;
    [key: string]: any;
  };
}

interface IAlgoliaRecommendResponse<T> {
  results?: Array<{
    hits?: T[];
  }>;
}

interface IRecommendClient {
  getFrequentlyBoughtTogether<T = IAlgoliaRecommendHit>(
    queries: IAlgoliaFBTQuery[],
  ): Promise<IAlgoliaRecommendResponse<T>>;
}

@Injectable()
export class AssociationRuleService {
  private readonly logger = new Logger(AssociationRuleService.name);
  private readonly EXCLUDED_STATUSES = ['CANCELLED', 'RETURNED', 'REFUNDED'];
  private readonly SENSITIVE_CATEGORIES = [
    'do-lot',
    'dao-sinh-ton',
    'gas-cam-trai',
  ];

  private recommendClient: IRecommendClient;
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
    let finalClient: IRecommendClient | undefined;

    const tryInit = (fn: unknown): IRecommendClient | undefined => {
      if (typeof fn === 'function') {
        try {
          const factory = fn as (
            a: string,
            b: string,
          ) => Record<string, unknown>;
          const instance = factory(appId, apiKey);

          if (
            instance &&
            typeof instance.getFrequentlyBoughtTogether === 'function'
          ) {
            return instance as unknown as IRecommendClient;
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
      this.logger.error('Khởi tạo thất bại: Không tìm thấy phương thức...');
      finalClient = {
        getFrequentlyBoughtTogether: async () => ({ results: [] }),
      } as unknown as IRecommendClient;
    }

    this.recommendClient = finalClient;
  }

  async getFrequentlyBoughtTogether(
    baseProductId: string,
    limit: number,
  ): Promise<IFBTRecommendation[]> {
    const objectId = new Types.ObjectId(baseProductId);

    const baseProduct = await this.productModel
      .findById(objectId)
      .select('price categories tags')
      .lean();

    if (!baseProduct) return [];

    let algoliaHits: IAlgoliaRecommendHit[] = [];

    try {
      const response = await this.recommendClient.getFrequentlyBoughtTogether([
        {
          indexName: this.indexName,
          objectID: baseProductId,
          maxRecommendations: limit * 3,
          queryParameters: {
            clickAnalytics: true,
          },
        },
      ]);

      if (response.results && response.results[0]?.hits) {
        algoliaHits = response.results[0].hits;
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Algolia Recommend] Lỗi gọi model: ${msg}`);
    }

    if (algoliaHits.length === 0) {
      return this.getFallbackFBT(
        baseProduct as unknown as ProductDocument,
        limit,
      );
    }

    const relatedIds = algoliaHits.map(
      (hit) => new Types.ObjectId(hit.objectID),
    );

    const productData = baseProduct as unknown as SafeProductData;
    const safePrice =
      typeof productData.price === 'number' ? productData.price : 0;

    const validProducts = await this.productModel
      .find({
        _id: { $in: relatedIds },
        status: ProductStatus.ACTIVE,
        is_deleted: false,
        stock: { $gt: 0 },
        rating_average: { $gte: 3 },
        tags: { $nin: ['pre-order', 'bulky', 'single-only'] },
        price: { $lte: safePrice * 3 },
      })
      .populate('categories', 'name slug')
      .lean();

    const productsMap = new Map<string, ProductDocument>();
    validProducts.forEach((p) => {
      productsMap.set(p._id.toString(), p as unknown as ProductDocument);
    });

    const cheapBucket: IFBTRecommendation[] = [];
    const mediumBucket: IFBTRecommendation[] = [];
    const highBucket: IFBTRecommendation[] = [];

    for (const hit of algoliaHits) {
      const p = productsMap.get(hit.objectID);
      if (!p) continue;

      interface PopulatedCat {
        slug: string;
      }
      const cats = (p.categories || []) as unknown as PopulatedCat[];
      const isSensitive = cats.some((c) =>
        this.SENSITIVE_CATEGORIES.includes(c.slug),
      );
      if (isSensitive) continue;

      const pData = p as unknown as SafeProductData;
      const recPrice = typeof pData.price === 'number' ? pData.price : 0;

      const score = hit._score ?? 0;
      if (score < 0.05) continue;

      // FIX: Gắn lại queryID cho object trả về Frontend
      type AlgoliaHitWithQueryID = IAlgoliaRecommendHit & {
        queryID?: string;
        __queryID?: string;
      };

      const hitWithQueryId = hit as AlgoliaHitWithQueryID;
      const queryID = hitWithQueryId.queryID || hitWithQueryId.__queryID;

      const recItem: IFBTRecommendation = {
        product: p,
        confidence: score,
        reason: 'Khách mua sản phẩm này thường mua kèm',
        query_id: queryID,
      };

      if (recPrice < safePrice * 0.3) {
        cheapBucket.push(recItem);
      } else if (recPrice < safePrice * 0.8) {
        mediumBucket.push(recItem);
      } else {
        highBucket.push(recItem);
      }
    }

    const results: IFBTRecommendation[] = [];

    if (cheapBucket.length > 0) {
      const item = cheapBucket.shift();
      if (item) results.push(item);
    }
    if (mediumBucket.length > 0) {
      const item = mediumBucket.shift();
      if (item) results.push(item);
    }
    if (highBucket.length > 0) {
      const item = highBucket.shift();
      if (item) results.push(item);
    }

    const remaining: IFBTRecommendation[] = [
      ...cheapBucket,
      ...mediumBucket,
      ...highBucket,
    ].sort((a, b) => b.confidence - a.confidence);

    while (results.length < limit && remaining.length > 0) {
      const item = remaining.shift();
      if (item) results.push(item);
    }

    if (results.length === 0) {
      return this.getFallbackFBT(
        baseProduct as unknown as ProductDocument,
        limit,
      );
    }

    return results;
  }

  private async getFallbackFBT(
    baseProduct: ProductDocument,
    limit: number,
  ): Promise<IFBTRecommendation[]> {
    const productData = baseProduct as unknown as SafeProductData;

    const safePrice =
      typeof productData.price === 'number' ? productData.price : 0;

    const products = await this.productModel
      .find({
        _id: { $ne: baseProduct._id },
        categories: { $in: baseProduct.categories },
        status: ProductStatus.ACTIVE,
        is_deleted: false,
        stock: { $gt: 0 },
        price: { $lte: safePrice * 1.5 },
      })
      .sort({ sold_count: -1, rating_average: -1 })
      .limit(limit)
      .lean();

    return products.map((p) => ({
      product: p as unknown as ProductDocument,
      confidence: 0,
      reason: 'Hoàn thiện bộ sưu tập của bạn',
    }));
  }
}
