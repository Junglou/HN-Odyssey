import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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

interface AtlasSearchConfig {
  index: string;
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

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(SearchHistory.name)
    private searchHistoryModel: Model<SearchHistoryDocument>,
    private readonly auditLogsService: AuditLogsService,
    @InjectModel(Attribute.name)
    private attributeModel: Model<AttributeDocument>,
    private algoliaService: AlgoliaService,
  ) {}

  private blackList = ['thô tục', 'sex', 'cấm', 'sensitive'];

  // 4. CẬP NHẬT LẠI HÀM NÀY (Thay thế mock rỗng)
  async reindexAttributes(): Promise<void> {
    try {
      // B1: Lấy danh sách các code thuộc tính đang cho phép lọc trên hệ thống
      const filterableAttributes = await this.attributeModel
        .find({
          is_active: true,
          is_filterable: true,
        })
        .select('code')
        .lean()
        .exec();

      const filterableCodes = filterableAttributes.map((attr) => attr.code);

      // B2: Gọi Algolia để khai báo lại các Facets này
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

    let searchConfig: AtlasSearchConfig = {
      index: 'default',
      text: {
        query: cleanKeyword,
        path: ['name', 'tags'],
        fuzzy: {
          maxEdits: 2,
          prefixLength: 1,
        },
      },
    };

    if (userId) {
      searchConfig = {
        ...searchConfig,
        score: {
          boost: {
            path: 'rating_average',
            undefined: 1,
          },
        },
      };
    } else {
      searchConfig = {
        ...searchConfig,
        score: {
          boost: {
            path: 'sold_count',
            undefined: 1,
          },
        },
      };
    }

    let productResults: any[] = [];

    try {
      productResults = await this.productModel.aggregate([
        {
          $search: searchConfig as unknown as Record<string, unknown>,
        },
        {
          $match: {
            status: ProductStatus.ACTIVE,
            is_deleted: false,
          },
        },
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
      const regex = new RegExp(this.escapeRegex(cleanKeyword), 'i');
      productResults = await this.productModel
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
    }

    const regex = new RegExp(this.escapeRegex(cleanKeyword), 'i');

    const [personalHistory, distinctTags] = await Promise.all([
      (async () => {
        if (!userId && !deviceId) return [];
        const historyQuery = {
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
      const filter: Record<string, any> = { keyword: keyword.toLowerCase() };
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
