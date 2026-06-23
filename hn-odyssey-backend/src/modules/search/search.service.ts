import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SearchHistory,
  SearchHistoryDocument,
} from './schemas/search-history.schema';
import {
  Product,
  ProductDocument,
} from '../products/catalog/schemas/product.schema';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';
import {
  Attribute,
  AttributeDocument,
} from '../products/attributes/schemas/attribute.schema';
import { AlgoliaService } from './algolia.service';
import { ConfigService } from '@nestjs/config';
import { UserBehavior } from '../recommendations/tracking/schemas/user-behavior.schema';

// 1. Cập nhật Interface để loại bỏ lỗi "unsafe assignment" của ESLint
interface AtlasSearchConfig {
  index: string;
  compound?: {
    must?: Record<string, unknown>[];
    should?: Record<string, unknown>[];
  };
  text?: {
    query: string;
    path: string | string[];
    fuzzy?: {
      maxEdits?: number;
      prefixLength?: number;
    };
  };
  score?: {
    boost?: {
      path: string;
      undefined?: number;
    };
  };
}

// Định nghĩa kiểu trả về cho Product để tránh lỗi any
export interface ProductSearchResult {
  _id: Types.ObjectId | string;
  name: string;
  slug: string;
  price: number;
  sale_price: number;
  thumbnail?: string;
  rating_average?: number;
  sold_count?: number;
  score?: number;
}

@Injectable()
export class SearchService {
  private blackList: string[];

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(SearchHistory.name)
    private searchHistoryModel: Model<SearchHistoryDocument>,
    private readonly auditLogsService: AuditLogsService,
    @InjectModel(Attribute.name)
    private attributeModel: Model<AttributeDocument>,
    private algoliaService: AlgoliaService,
    private configService: ConfigService,
    @InjectModel(UserBehavior.name) private behaviorModel: Model<UserBehavior>,
  ) {
    const envBlacklist = this.configService.get<string>('SEARCH_BLACKLIST');
    this.blackList = envBlacklist
      ? envBlacklist.split(',').map((word) => word.trim().toLowerCase())
      : ['thô tục', 'sex', 'cấm', 'sensitive'];
  }

  // Lấy sở thích của User
  private async getUserPreferences(userId: string): Promise<string[]> {
    const behaviors = await this.behaviorModel.aggregate<{
      _id: string;
      count: number;
    }>([
      {
        $match: {
          user_id: new Types.ObjectId(userId),
          action: 'VIEW_PRODUCT',
        },
      },
      { $group: { _id: '$metadata.search_keyword', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
    ]);

    return behaviors.map((b) => b._id).filter(Boolean);
  }

  async reindexAttributes(): Promise<void> {
    try {
      const filterableAttributes = await this.attributeModel
        .find({
          is_active: true,
          is_filterable: true,
        })
        .select('code')
        .lean()
        .exec();

      const filterableCodes = filterableAttributes.map((attr) => attr.code);

      if (filterableCodes.length > 0) {
        await this.algoliaService.updateFacetsConfig(filterableCodes);
        console.log(
          `[SearchService] Đã kích hoạt Re-index cấu hình bộ lọc cho ${filterableCodes.length} thuộc tính.`,
        );
      }
    } catch (error) {
      console.error(
        '[SearchService] Lỗi hệ thống khi Re-index thuộc tính Algolia:',
        error,
      );
    }
  }

  async getSuggestions(
    keyword: string,
    userId?: string,
    deviceId?: string,
    ip?: string,
    userAgent?: string,
  ) {
    if (!keyword || keyword.trim() === '') {
      return this.getHistoryAndTrending(userId, deviceId);
    }

    const cleanKeyword = keyword.trim();

    if (
      this.blackList.some((bad) => cleanKeyword.toLowerCase().includes(bad))
    ) {
      return { keywords: [], products: [] };
    }

    void this.logSearchTerm(cleanKeyword, userId, deviceId);

    // Khai báo kiểu AtlasSearchConfig đã thiết lập
    const searchConfig: AtlasSearchConfig = {
      index: 'default',
      compound: {
        must: [
          {
            text: {
              query: cleanKeyword,
              path: ['name', 'tags'],
              fuzzy: { maxEdits: 2, prefixLength: 1 },
            },
          },
        ],
        should: [],
      },
    };

    if (userId) {
      const favoriteKeywords = await this.getUserPreferences(userId);

      if (favoriteKeywords && favoriteKeywords.length > 0) {
        favoriteKeywords.forEach((favWord) => {
          searchConfig.compound?.should?.push({
            text: {
              query: favWord,
              path: ['name', 'tags', 'categories.name'],
              score: { boost: { value: 3 } },
            },
          });
        });
      }

      searchConfig.compound?.should?.push({
        near: {
          path: 'rating_average',
          origin: 5,
          pivot: 2,
          score: { boost: { value: 1.5 } },
        },
      });
    } else {
      searchConfig.compound?.should?.push({
        near: {
          path: 'sold_count',
          origin: 1000,
          pivot: 100,
          score: { boost: { value: 2 } },
        },
      });
    }

    // Khai báo mảng kết quả có định dạng rõ ràng
    let productResults: ProductSearchResult[] = [];

    try {
      productResults = await this.productModel.aggregate<ProductSearchResult>([
        { $search: searchConfig as unknown as Record<string, unknown> },
        { $match: { status: ProductStatus.ACTIVE, is_deleted: false } },
        { $limit: 5 },
        {
          $project: {
            _id: 1,
            name: 1,
            slug: 1,
            price: 1,
            sale_price: 1,
            thumbnail: 1,
            rating_average: 1,
            sold_count: 1,
            score: { $meta: 'searchScore' },
          },
        },
      ]);
    } catch {
      // Fix lỗi unused variable 'error'
      const regex = new RegExp(this.escapeRegex(cleanKeyword), 'i');
      const fallbackResults = await this.productModel
        .find({
          status: ProductStatus.ACTIVE,
          is_deleted: false,
          $or: [{ name: { $regex: regex } }, { tags: { $regex: regex } }],
        })
        .sort({ sold_count: -1 })
        .limit(5)
        .select(
          '_id name slug price sale_price thumbnail rating_average sold_count',
        )
        .lean()
        .exec();

      // Ép kiểu an toàn kết quả trả về của find()
      productResults = fallbackResults as unknown as ProductSearchResult[];
    }

    const regex = new RegExp(this.escapeRegex(cleanKeyword), 'i');

    const [personalHistory, distinctTags] = await Promise.all([
      (async () => {
        if (!userId && !deviceId) return [];
        const historyQuery: Record<string, unknown> = {
          ...(userId ? { user_id: userId } : { device_id: deviceId }),
          keyword: { $regex: regex },
        };
        const historyDocs = await this.searchHistoryModel
          .find(historyQuery)
          .sort({ last_searched_at: -1 })
          .limit(3)
          .select('keyword');
        return historyDocs.map((h) => h.keyword);
      })(),
      this.productModel.distinct('tags', {
        tags: { $regex: regex },
        status: ProductStatus.ACTIVE,
      }),
    ]);

    const uniqueKeywords = Array.from(
      new Set([...personalHistory, ...distinctTags]),
    );

    if (userId) {
      void this.auditLogsService.log({
        action: 'SEARCH_SUGGESTION',
        collection_name: 'products',
        actor_id: userId,
        department: Department.MARKETING,
        detail: { keyword: cleanKeyword, results_count: productResults.length },
        ip: ip || '',
        user_agent: userAgent || '',
      });
    }

    return {
      keywords: uniqueKeywords.slice(0, 10),
      products: productResults,
    };
  }

  private async getHistoryAndTrending(userId?: string, deviceId?: string) {
    let history: string[] = [];
    if (userId || deviceId) {
      const query = userId ? { user_id: userId } : { device_id: deviceId };
      const logs = await this.searchHistoryModel
        .find(query)
        .sort({ last_searched_at: -1 })
        .limit(5)
        .select('keyword');
      history = logs.map((l) => l.keyword);
    }

    const trendingLogs = await this.searchHistoryModel
      .find()
      .sort({ count: -1 })
      .limit(5)
      .select('keyword');
    const trending = trendingLogs.map((l) => l.keyword);

    return { history, trending };
  }

  private async logSearchTerm(
    keyword: string,
    userId?: string,
    deviceId?: string,
  ) {
    try {
      const filter: Record<string, unknown> = {
        keyword: keyword.toLowerCase(),
      };
      if (userId) filter.user_id = userId;
      else if (deviceId) filter.device_id = deviceId;
      else return;

      await this.searchHistoryModel.findOneAndUpdate(
        filter,
        {
          $inc: { count: 1 },
          $set: { last_searched_at: new Date() },
        },
        { upsert: true, new: true },
      );
    } catch (error) {
      console.error('Error logging search:', error);
    }
  }

  private escapeRegex(text: string) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }
}
