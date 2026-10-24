import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { NotificationEvent } from 'src/modules/notifications/notification-policy.constant';
import {
  UserBehavior,
  BehaviorAction,
} from 'src/modules/recommendations/tracking/schemas/user-behavior.schema';
import { Cart } from 'src/modules/sales/cart/schemas/cart.schema';

interface CheckoutSpikeAggResult {
  _id: null;
  totalCheckouts: number;
  totalPurchases: number;
}

interface AbandonedCartSpikeAggResult {
  _id: string; // SKU
  abandonedCount: number;
}

@Injectable()
export class BusinessMonitoringCronService {
  private readonly logger = new Logger(BusinessMonitoringCronService.name);

  private readonly CHECKOUT_ABANDONMENT_THRESHOLD: number; // % rớt thanh toán
  private readonly MIN_CHECKOUT_SESSIONS: number; // Số phiên checkout tối thiểu để đánh giá
  private readonly ABANDONED_CART_SKU_THRESHOLD: number; // Số lượt bỏ giỏ / SKU / giờ

  constructor(
    @InjectModel(UserBehavior.name)
    private readonly behaviorModel: Model<UserBehavior>,
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {
    // Biến môi trường luôn là chuỗi → ép về số
    this.CHECKOUT_ABANDONMENT_THRESHOLD = Number(
      this.configService.get('CHECKOUT_ABANDONMENT_THRESHOLD', 80),
    );
    this.MIN_CHECKOUT_SESSIONS = Number(
      this.configService.get('MIN_CHECKOUT_SESSIONS', 10),
    );
    this.ABANDONED_CART_SKU_THRESHOLD = Number(
      this.configService.get('ABANDONED_CART_SKU_THRESHOLD', 50),
    );
  }

  // Chạy mỗi 30 phút, xét dữ liệu 1 giờ gần nhất.
  // Bất thường kéo dài sẽ được GỘP vào cùng 1 thông báo (xem NOTIFICATION_POLICIES),
  // không tạo dòng mới mỗi 30 phút.
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

  // US.90 - AC8: Tỷ lệ bỏ dở thanh toán tăng đột biến
  private async checkCheckoutAbandonmentSpike(startTime: Date) {
    try {
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
      if (stat.totalCheckouts < this.MIN_CHECKOUT_SESSIONS) return;

      const dropped = stat.totalCheckouts - stat.totalPurchases;
      const dropRate = (dropped / stat.totalCheckouts) * 100;
      if (dropRate < this.CHECKOUT_ABANDONMENT_THRESHOLD) return;

      this.logger.warn(
        `[CẢNH BÁO] Tỷ lệ rớt thanh toán cao bất thường: ${dropRate.toFixed(2)}%`,
      );

      await this.notificationsService.notify(NotificationEvent.CHECKOUT_DROP, {
        title: 'Tỷ lệ bỏ dở thanh toán tăng đột biến',
        message: `${dropRate.toFixed(1)}% phiên checkout trong 1 giờ qua không hoàn tất (${dropped}/${stat.totalCheckouts}). Kiểm tra phễu chuyển đổi và cổng thanh toán.`,
        metadata: {
          drop_rate: Number(dropRate.toFixed(1)),
          total_checkouts: stat.totalCheckouts,
        },
      });
    } catch (error) {
      this.logger.error('Lỗi khi check Checkout Abandonment Spike', error);
    }
  }

  // US.91 - AC8: Một SKU bị bỏ giỏ tăng vọt
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
        this.logger.warn(
          `[CẢNH BÁO] SKU ${item._id} bị bỏ giỏ hàng liên tục: ${item.abandonedCount} lượt`,
        );

        await this.notificationsService.notify(NotificationEvent.CART_ANOMALY, {
          title: `SKU ${item._id} bị bỏ giỏ bất thường`,
          message: `${item.abandonedCount} lượt thêm vào giỏ nhưng không thanh toán trong 1 giờ qua. Kiểm tra hiển thị và giá của sản phẩm.`,
          dedupeKey: `${NotificationEvent.CART_ANOMALY}:${item._id}`,
          metadata: { sku: item._id, abandoned_count: item.abandonedCount },
        });
      }
    } catch (error) {
      this.logger.error('Lỗi khi check Abandoned Cart Spike', error);
    }
  }
}
