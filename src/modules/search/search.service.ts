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

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(SearchHistory.name)
    private searchHistoryModel: Model<SearchHistoryDocument>,
  ) {}

  private blackList = ['thô tục', 'sex', 'cấm', 'sensitive']; // AC12

  async getSuggestions(keyword: string, userId?: string, deviceId?: string) {
    // AC1: Chưa nhập gì -> Trả về History & Trending
    if (!keyword || keyword.trim() === '') {
      return this.getHistoryAndTrending(userId, deviceId);
    }

    const cleanKeyword = keyword.trim();

    // AC12: Blacklist
    if (
      this.blackList.some((bad) => cleanKeyword.toLowerCase().includes(bad))
    ) {
      return { keywords: [], products: [] };
    }

    // AC15: Log (Fire & Forget)
    this.logSearchTerm(cleanKeyword, userId, deviceId);

    // PHẦN 1: TÌM SẢN PHẨM BẰNG ATLAS SEARCH (FUZZY AI)

    //Pipeline này thay thế cho cả Text Search và Regex cũ
    const productResults = await this.productModel.aggregate([
      {
        $search: {
          index: 'default', // Tên index bạn tạo trên Atlas
          text: {
            query: cleanKeyword,
            path: ['name', 'tags'], // Tìm trong tên và tags
            fuzzy: {
              maxEdits: 2, // Cho phép sai lỗi chính tả (ipone -> iphone)
              prefixLength: 1, // Ký tự đầu phải đúng
            },
          },
        },
      },
      {
        $match: {
          status: ProductStatus.ACTIVE,
          is_deleted: false,
        },
      },
      { $limit: 5 }, // AC11: Giới hạn 5 sản phẩm
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
          score: { $meta: 'searchScore' }, // Lấy điểm phù hợp để debug nếu cần
        },
      },
    ]);

    // PHẦN 2: TÌM TỪ KHÓA GỢI Ý (HISTORY + TAGS)

    // Regex vẫn dùng cho việc highlight và tìm tags đơn giản
    const regex = new RegExp(this.escapeRegex(cleanKeyword), 'i');

    const [personalHistory, distinctTags] = await Promise.all([
      // 2.1. Lịch sử cá nhân
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

      // 2.2. Tags hệ thống
      this.productModel.distinct('tags', {
        tags: { $regex: regex },
        status: ProductStatus.ACTIVE,
      }),
    ]);

    // PHẦN 3: TỔNG HỢP
    const uniqueKeywords = Array.from(
      new Set([...personalHistory, ...distinctTags]),
    );

    return {
      keywords: uniqueKeywords.slice(0, 10),
      products: productResults,
    };
  }

  // AC1: Logic lấy Lịch sử & Xu hướng
  private async getHistoryAndTrending(userId?: string, deviceId?: string) {
    // 1. Lịch sử cá nhân
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

    // 2. Xu hướng (Trending) - Lấy các từ khóa được tìm nhiều nhất toàn sàn
    const trendingLogs = await this.searchHistoryModel
      .find()
      .sort({ count: -1 }) // Sắp xếp theo số lần tìm
      .limit(5)
      .select('keyword');
    const trending = trendingLogs.map((l) => l.keyword);

    return { history, trending };
  }

  // AC15: Ghi Log thông minh (Update count nếu đã tồn tại)
  private async logSearchTerm(
    keyword: string,
    userId?: string,
    deviceId?: string,
  ) {
    try {
      const filter: any = { keyword: keyword.toLowerCase() };
      // Nếu user đã login, log theo user, ngược lại log theo device
      if (userId) filter.user_id = userId;
      else if (deviceId) filter.device_id = deviceId;
      else return; // Không xác định được người dùng

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
