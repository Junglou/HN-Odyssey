import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import {
  UserBehavior,
  BehaviorAction,
} from 'src/modules/recommendations/tracking/schemas/user-behavior.schema';
import { Cart } from 'src/modules/sales/cart/schemas/cart.schema';
import {
  NotificationType,
  NotificationPriority,
} from 'src/modules/notifications/schemas/notification-log.schema';
import { Product } from 'src/modules/products/catalog/schemas/product.schema';
import { ConfigService } from '@nestjs/config';

interface CheckoutSpikeAggResult {
  _id: null;
  totalCheckouts: number;
  totalPurchases: number;
}

interface AbandonedCartSpikeAggResult {
  _id: string; // Tương ứng với SKU
  abandonedCount: number;
}

interface ProductWarehouseInfo {
  _id: Types.ObjectId;
  warehouse_id?: Types.ObjectId;
}

@Injectable()
export class BusinessMonitoringCronService {
  private readonly logger = new Logger(BusinessMonitoringCronService.name);

  // Ngưỡng cảnh báo (Có thể chuyển vào .env hoặc Database config)
  private readonly CHECKOUT_ABANDONMENT_THRESHOLD: number; // 80% rớt thanh toán
  private readonly MIN_CHECKOUT_SESSIONS: number; // Cần tối thiểu 10 lượt checkout mới tính tỷ lệ để tránh nhiễu
  private readonly ABANDONED_CART_SKU_THRESHOLD: number; // 1 SKU bị bỏ giỏ > 50 lần/giờ

  constructor(
    @InjectModel(UserBehavior.name)
    private readonly behaviorModel: Model<UserBehavior>,
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
    private readonly notificationsService: NotificationsService,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    private readonly configService: ConfigService,
  ) {
    // Lấy dữ liệu từ .env, nếu không có thì dùng giá trị mặc định (fallback)
    this.CHECKOUT_ABANDONMENT_THRESHOLD = this.configService.get<number>(
      'CHECKOUT_ABANDONMENT_THRESHOLD',
      80, // Giá trị mặc định nếu .env trống
    );
    this.MIN_CHECKOUT_SESSIONS = this.configService.get<number>(
      'MIN_CHECKOUT_SESSIONS',
      10,
    );
    this.ABANDONED_CART_SKU_THRESHOLD = this.configService.get<number>(
      'ABANDONED_CART_SKU_THRESHOLD',
      50,
    );
  }

  // Chạy mỗi 30 phút một lần để quét bất thường
  // Lấy dữ liệu trong 1 giờ gần nhất để đảm bảo phát hiện kịp thời các vấn đề đang diễn ra
  @Cron(CronExpression.EVERY_30_MINUTES)
  async monitorBusinessAnomalies() {
    this.logger.log('Bắt đầu chạy CronJob giám sát hoạt động kinh doanh...');

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    await Promise.all([
      this.checkCheckoutAbandonmentSpike(oneHourAgo),
      this.checkAbandonedCartSpike(oneHourAgo),
    ]);
  }

  // US.90 - AC8: Cảnh báo khi tỷ lệ bỏ thanh toán (Checkout Abandonment) tăng đột biến
  private async checkCheckoutAbandonmentSpike(startTime: Date) {
    try {
      // Tiêm Type CheckoutSpikeAggResult vào phương thức aggregate
      const aggResult =
        await this.behaviorModel.aggregate<CheckoutSpikeAggResult>([
          { $match: { createdAt: { $gte: startTime } } },
          {
            $group: {
              _id: '$session_id',
              actions: { $addToSet: '$action' },
            },
          },
          {
            $group: {
              _id: null,
              totalCheckouts: {
                $sum: {
                  $cond: [
                    { $in: [BehaviorAction.BEGIN_CHECKOUT, '$actions'] },
                    1,
                    0,
                  ],
                },
              },
              totalPurchases: {
                $sum: {
                  $cond: [{ $in: [BehaviorAction.PURCHASE, '$actions'] }, 1, 0],
                },
              },
            },
          },
        ]);

      const stat = aggResult[0] || { totalCheckouts: 0, totalPurchases: 0 };

      // Chỉ kích hoạt nếu số lượng checkout đủ lớn để đánh giá
      if (stat.totalCheckouts >= this.MIN_CHECKOUT_SESSIONS) {
        const dropRate =
          ((stat.totalCheckouts - stat.totalPurchases) / stat.totalCheckouts) *
          100;

        if (dropRate >= this.CHECKOUT_ABANDONMENT_THRESHOLD) {
          this.logger.warn(
            `[CẢNH BÁO] Tỷ lệ rớt thanh toán cao bất thường: ${dropRate.toFixed(2)}%`,
          );

          const GLOBAL_SYSTEM_AREA = '';

          await this.notificationsService.createAndSendToMultipleRoles({
            roles: ['SUPER_ADMIN', 'ADMIN'],
            warehouse_id: GLOBAL_SYSTEM_AREA,
            title: '🔥 Cảnh báo: Rớt thanh toán đột biến!',
            message: `Tỷ lệ bỏ dở thanh toán trong 1 giờ qua đạt mức ${dropRate.toFixed(1)}% (${stat.totalCheckouts - stat.totalPurchases}/${stat.totalCheckouts} phiên). Vui lòng kiểm tra cổng thanh toán ngay!`,
            type: NotificationType.SYSTEM,
            priority: NotificationPriority.CRITICAL,
            metadata: {
              error_code: 'HIGH_CHECKOUT_ABANDONMENT',
              drop_rate: dropRate,
              total_checkouts: stat.totalCheckouts,
              target_url: '/portal/reports/business/behavior-abandonment',
            },
          });
        }
      }
    } catch (error) {
      this.logger.error('Lỗi khi check Checkout Abandonment Spike', error);
    }
  }

  // US.91 - AC8: Cảnh báo khi số lượng bỏ giỏ hàng của một SKU tăng vọt

  private async checkAbandonedCartSpike(startTime: Date) {
    try {
      const cartAgg =
        await this.cartModel.aggregate<AbandonedCartSpikeAggResult>([
          {
            $match: {
              updatedAt: { $gte: startTime },
              'items.0': { $exists: true },
            },
          },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.sku',
              abandonedCount: { $sum: '$items.quantity' },
            },
          },
          {
            $match: {
              abandonedCount: { $gte: this.ABANDONED_CART_SKU_THRESHOLD },
            },
          },
        ]);

      for (const item of cartAgg) {
        // item._id chính là SKU được gom nhóm từ Aggregate phía trên
        const product = await this.productModel
          .findOne({ sku: item._id })
          .select('warehouse_id')
          .lean<ProductWarehouseInfo>()
          .exec();

        this.logger.warn(
          `[CẢNH BÁO] SKU ${item._id} bị bỏ giỏ hàng liên tục: ${item.abandonedCount} lượt`,
        );

        const finalWarehouseId = product?.warehouse_id
          ? product.warehouse_id
          : '';

        await this.notificationsService.createAndSendToMultipleRoles({
          roles: ['SUPER_ADMIN', 'MARKETING_MANAGER'],
          warehouse_id: finalWarehouseId,
          title: `⚠️ Dấu hiệu bất thường: SKU ${item._id}`,
          message: `Sản phẩm mã ${item._id} bị bỏ vào giỏ hàng nhưng không thanh toán tới ${item.abandonedCount} lần trong giờ qua. Có thể do lỗi hiển thị hoặc cấu hình giá!`,
          type: NotificationType.SYSTEM,
          priority: NotificationPriority.HIGH,
          metadata: {
            error_code: 'ABNORMAL_CART_ABANDONMENT',
            sku: item._id,
            abandoned_count: item.abandonedCount,
            target_url: `/portal/reports/business/abandoned-carts?sku=${item._id}`,
          },
        });
      }
    } catch (error) {
      this.logger.error('Lỗi khi check Abandoned Cart Spike', error);
    }
  }
}
