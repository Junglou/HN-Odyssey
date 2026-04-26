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
  brand?: string;
  price?: number;
}

interface IAlgoliaRecommendHit {
  objectID: string;
  _score?: number;
}

// 1. Định nghĩa kiểu dữ liệu chặt chẽ cho Request và Response của Algolia để tránh lỗi ESLint Unsafe any
interface IAlgoliaFBTQuery {
  indexName: string;
  objectID: string;
  maxRecommendations?: number;
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

  // [FIX AC9]: Khai báo danh sách các tập đoàn/brand đối thủ không đội trời chung
  private readonly COMPETITOR_MAP: Record<string, string[]> = {
    patagonia: ['the north face', 'columbia', 'arcteryx', 'marmot'],
    'the north face': ['patagonia', 'columbia', 'arcteryx', 'marmot'],
    columbia: ['patagonia', 'the north face', 'marmot'],
    arcteryx: ['patagonia', 'the north face', 'mammut'],
    marmot: ['patagonia', 'the north face', 'columbia'],
    osprey: ['gregory', 'deuter'], // Dành cho mảng balo leo núi
    salomon: ['merrell', 'la sportiva', 'hoka'], // Dành cho mảng giày trail/trekking
  };

  // 2. Sử dụng Interface tự định nghĩa thay vì ReturnType<typeof recommend>
  private recommendClient: IRecommendClient;
  private readonly indexName: string;

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private configService: ConfigService,
    @InjectModel('UserBehavior') private behaviorModel: Model<any>,
  ) {
    const appId = this.configService.get<string>('ALGOLIA_APP_ID') || '';
    console.log('=== APP ID KIỂM TRA ===', appId ? 'ĐÃ CÓ DATA' : 'BỊ RỖNG');
    const apiKey = this.configService.get<string>('ALGOLIA_ADMIN_KEY') || '';
    this.indexName =
      this.configService.get<string>('ALGOLIA_INDEX_NAME') || 'products';

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rawModule: unknown = require('@algolia/recommend');
    console.log('=== DIỆN MẠO THẬT CỦA ALGOLIA MODULE ===', rawModule);
    let finalClient: IRecommendClient | undefined;

    // Hàm thử nghiệm: Gọi thử function và kiểm tra xem kết quả trả về có đúng là Recommend Client không
    const tryInit = (fn: unknown): IRecommendClient | undefined => {
      if (typeof fn === 'function') {
        try {
          // Ép kiểu an toàn để ESLint không báo no-unsafe-call
          const factory = fn as (
            a: string,
            b: string,
          ) => Record<string, unknown>;
          const instance = factory(appId, apiKey);

          // Kiểm chứng: Client thật sự phải có hàm này
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

    // Quét và thử tất cả các khả năng
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
        'Khởi tạo thất bại: Không tìm thấy phương thức getFrequentlyBoughtTogether trong module.',
      );
      throw new Error('Algolia Recommend Init Failure');
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
      .select('price categories tags brand')
      .lean();

    if (!baseProduct) return [];

    let algoliaHits: IAlgoliaRecommendHit[] = [];

    // 1. GỌI MODEL ALGOLIA RECOMMEND
    try {
      const response = await this.recommendClient.getFrequentlyBoughtTogether([
        {
          indexName: this.indexName,
          objectID: baseProductId,
          maxRecommendations: limit * 3, // Lấy dư để phòng trừ bị lọc mất do hết hàng
        },
      ]);

      if (response.results && response.results[0]?.hits) {
        // 4. Response giờ đã được định nghĩa rõ ràng, không còn lỗi Unsafe Assignment/Member Access
        algoliaHits = response.results[0].hits;
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Algolia Recommend] Lỗi gọi model: ${msg}`);
      // Nếu Algolia sập, mảng algoliaHits rỗng -> Tự động rớt xuống Fallback bên dưới
    }

    // 2. FALLBACK NẾU ALGOLIA CHƯA CÓ DATA HOẶC LỖI
    if (algoliaHits.length === 0) {
      return this.getFallbackFBT(
        baseProduct as unknown as ProductDocument,
        limit,
      );
    }

    // Lấy danh sách ID từ Algolia
    const relatedIds = algoliaHits.map(
      (hit) => new Types.ObjectId(hit.objectID),
    );

    // 3. TÍNH TOÁN CÁC ĐIỀU KIỆN CHẶN (AC9, AC16)
    const productData = baseProduct as unknown as SafeProductData;
    let competitorBrands: string[] = [];
    if (typeof productData.brand === 'string') {
      competitorBrands =
        this.COMPETITOR_MAP[productData.brand.toLowerCase()] || [];
    }
    const safePrice =
      typeof productData.price === 'number' ? productData.price : 0;

    // 4. KIỂM TRA DB (Tồn kho, Trạng thái, Chặn đối thủ)
    const validProducts = await this.productModel
      .find({
        _id: { $in: relatedIds },
        status: ProductStatus.ACTIVE,
        is_deleted: false,
        stock: { $gt: 0 },
        rating_average: { $gte: 3 }, // AC18: Lọc rating xấu
        tags: { $nin: ['pre-order', 'bulky', 'single-only'] }, // AC19: Restricted
        price: { $lte: safePrice * 3 }, // AC16: Lọc chênh lệch giá
        brand: { $nin: competitorBrands }, // AC9: Chặn đối thủ
      })
      .populate('categories', 'name slug')
      .lean();

    // 5. MAPPING LẠI KẾT QUẢ THEO ĐÚNG THỨ TỰ RANKING CỦA ALGOLIA
    const productsMap = new Map<string, ProductDocument>();
    validProducts.forEach((p) => {
      productsMap.set(p._id.toString(), p as unknown as ProductDocument);
    });

    // [FIX AC20]: Phân loại Price Tiers (Giỏ hàng cân bằng)
    const cheapBucket: IFBTRecommendation[] = [];
    const mediumBucket: IFBTRecommendation[] = []; // Đã sửa kiểu dữ liệu IFBTInside thành IFBTRecommendation
    const highBucket: IFBTRecommendation[] = [];

    for (const hit of algoliaHits) {
      const p = productsMap.get(hit.objectID);
      if (!p) continue;

      // Kiểm tra AC14: Category nhạy cảm
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

      const recItem: IFBTRecommendation = {
        product: p,
        confidence: score,
        reason: 'Khách mua sản phẩm này thường mua kèm', // AC21
      };

      // Phân bổ vào các rổ (Dựa trên % giá so với sản phẩm chính)
      if (recPrice < safePrice * 0.3) {
        cheapBucket.push(recItem); // Dưới 30% -> Phụ kiện rẻ
      } else if (recPrice < safePrice * 0.8) {
        mediumBucket.push(recItem); // 30% - 80% -> Đồ tầm trung
      } else {
        highBucket.push(recItem); // Trên 80% -> Đồ giá cao/Chính
      }
    }

    const results: IFBTRecommendation[] = [];

    // Bốc từ mỗi rổ 1 sản phẩm có điểm cao nhất để đảm bảo cơ cấu
    // Sử dụng kiểm tra biến an toàn thay vì toán tử non-null assertion (!) để pass ESLint
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

    // Nếu chưa đủ limit (ví dụ limit = 3 nhưng bị thiếu rổ cao), đắp thêm từ các sản phẩm còn lại
    const remaining: IFBTRecommendation[] = [
      ...cheapBucket,
      ...mediumBucket,
      ...highBucket,
    ].sort((a, b) => b.confidence - a.confidence); // Ưu tiên điểm cao

    while (results.length < limit && remaining.length > 0) {
      const item = remaining.shift();
      if (item) results.push(item);
    }

    // Fallback cuối cùng nếu list bị DB lọc sạch
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
    let competitorBrands: string[] = [];

    if (typeof productData.brand === 'string') {
      const baseBrand = productData.brand.toLowerCase();
      competitorBrands = this.COMPETITOR_MAP[baseBrand] || [];
    }

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
        brand: { $nin: competitorBrands }, // <-- [FIX AC9] Áp dụng cả ở Fallback
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
