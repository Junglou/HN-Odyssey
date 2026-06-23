import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import {
  UserBehavior,
  BehaviorAction,
} from 'src/modules/recommendations/tracking/schemas/user-behavior.schema';
import { ProductStatus } from 'src/common/enums/product-status.enum';

@Injectable()
export class ViewBasedService {
  private readonly logger = new Logger(ViewBasedService.name);

  constructor(
    @InjectModel(UserBehavior.name) private behaviorModel: Model<UserBehavior>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  // AC1, AC2, AC6: Khu vực "Sản phẩm vừa xem" (Recently Viewed) - Hợp nhất đa thiết bị & FIFO
  async getRecentlyViewed(
    sessionId: string,
    userId?: string,
    limit: number = 12,
    currentProductId?: string,
  ): Promise<ProductDocument[]> {
    try {
      const matchQuery: Record<string, any> = {
        action: BehaviorAction.VIEW_PRODUCT,
      };

      // AC6: Đồng bộ đa thiết bị - Nếu có userId, gom toàn bộ lịch sử từ mọi thiết bị (session)
      if (userId) {
        matchQuery.user_id = new Types.ObjectId(userId);
      } else {
        matchQuery.session_id = sessionId;
      }

      // Query raw behaviors, ưu tiên mới nhất
      const behaviors = await this.behaviorModel
        .find(matchQuery)
        .sort({ createdAt: -1 })
        .limit(50) // Lấy dư để trừ hao khi lọc trùng
        .select('metadata.product_id createdAt')
        .lean();

      // AC2 & AC7: Lọc trùng lặp (FIFO - Chỉ lấy object mới nhất của mỗi Product)
      const uniqueProductIds: string[] = [];
      for (const b of behaviors) {
        const pId = b.metadata?.product_id;

        // [FIX US1-AC7]: Bỏ qua nếu pId trùng với sản phẩm đang xem hiện tại
        if (currentProductId && pId === currentProductId) continue;

        if (pId && !uniqueProductIds.includes(pId)) {
          uniqueProductIds.push(pId);
        }
        if (uniqueProductIds.length >= limit) break; // AC2: Giới hạn 10-12
      }

      if (uniqueProductIds.length === 0) return [];

      // AC7: Ẩn sản phẩm hết hàng (OOS) và lấy thông tin chi tiết
      const products = await this.productModel
        .find({
          _id: { $in: uniqueProductIds.map((id) => new Types.ObjectId(id)) },
          status: ProductStatus.ACTIVE,
          is_deleted: false,
          stock: { $gt: 0 }, // AC7: Không gợi ý sản phẩm không thể mua
        })
        .lean();

      // Mapping lại theo đúng thứ tự FIFO ban đầu (mới nhất xem trước)
      const productsMap = new Map(products.map((p) => [p._id.toString(), p]));
      return uniqueProductIds
        .map((id) => productsMap.get(id))
        .filter(Boolean) as unknown as ProductDocument[];
    } catch (error) {
      this.logger.error(`Lỗi getRecentlyViewed: ${(error as Error).message}`);
      return [];
    }
  }

  // AC10: Quyền riêng tư - Tùy chọn xóa lịch sử xem
  async clearViewHistory(sessionId: string, userId?: string): Promise<boolean> {
    try {
      const matchQuery: Record<string, any> = {
        action: BehaviorAction.VIEW_PRODUCT,
      };
      if (userId) {
        matchQuery.user_id = new Types.ObjectId(userId);
      } else {
        matchQuery.session_id = sessionId;
      }
      await this.behaviorModel.deleteMany(matchQuery);
      return true;
    } catch (error) {
      this.logger.error(`Lỗi clearViewHistory: ${(error as Error).message}`);
      return false;
    }
  }
}
