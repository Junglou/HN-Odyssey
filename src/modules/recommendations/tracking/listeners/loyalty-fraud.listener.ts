import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  LoyaltyHistory,
  LoyaltyHistoryDocument,
} from 'src/modules/marketing/loyalty/schemas/loyalty-history.schema';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import {
  NotificationType,
  NotificationPriority,
} from 'src/modules/notifications/schemas/notification-log.schema';
import {
  Customer,
  CustomerDocument,
} from 'src/modules/users/customers/schemas/customer.schema';

@Injectable()
export class LoyaltyFraudListener {
  private readonly logger = new Logger(LoyaltyFraudListener.name);

  // Ngưỡng gian lận cấu hình
  private readonly FRAUD_THRESHOLD_AMOUNT = 500000; // Nhận > 500k điểm / lần
  private readonly FRAUD_FREQUENCY_LIMIT = 5; // > 5 lần tích điểm trong 1 giờ

  constructor(
    @InjectModel(LoyaltyHistory.name)
    private loyaltyModel: Model<LoyaltyHistoryDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent('loyalty.points_earned')
  async handleEarnFraudDetection(data: {
    customer_id: string;
    amount: number;
    transaction_id: string;
  }) {
    try {
      const { customer_id, amount } = data;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // 1. Kiểm tra tích điểm đột biến (Huge Amount)
      if (amount >= this.FRAUD_THRESHOLD_AMOUNT) {
        await this.flagFraudUser(
          customer_id,
          `Nhận số điểm quá lớn bất thường: ${amount} điểm`,
        );
        return;
      }

      // 2. Kiểm tra tần suất (High Frequency)
      const recentTransactionsCount = await this.loyaltyModel.countDocuments({
        customer_id: new Types.ObjectId(customer_id),
        type: 'EARN',
        createdAt: { $gte: oneHourAgo },
      });

      if (recentTransactionsCount >= this.FRAUD_FREQUENCY_LIMIT) {
        await this.flagFraudUser(
          customer_id,
          `Tích điểm ${recentTransactionsCount} lần chỉ trong 1 giờ`,
        );
      }
    } catch (error) {
      this.logger.error('Lỗi khi kiểm tra gian lận Loyalty', error);
    }
  }

  private async flagFraudUser(customerId: string, reason: string) {
    this.logger.warn(`[FRAUD ALERT] User ${customerId} - Lý do: ${reason}`);

    // Gắn thẻ User và khóa tạm quyền đánh giá/mua sắm nếu cần thiết (dựa vào trường review_access ở User)
    await this.customerModel.findByIdAndUpdate(customerId, {
      $set: {
        internal_note: `[CẢNH BÁO GIAN LẬN HỆ THỐNG]: ${reason}`,
        status_reason: 'Tạm khóa do nghi ngờ gian lận Loyalty',
      },
    });

    // Bắn Notification cho Quản trị viên
    await this.notificationsService.createAndSendToMultipleRoles({
      roles: ['SUPER_ADMIN', 'MARKETING_MANAGER'],
      warehouse_id: undefined,
      title: '⚠️ Cảnh báo Gian lận Điểm thưởng',
      message: `Phát hiện hành vi tích điểm bất thường từ khách hàng ID: ${customerId}. Lý do: ${reason}. Vui lòng kiểm tra đối soát!`,
      type: NotificationType.SECURITY,
      priority: NotificationPriority.CRITICAL,
      metadata: { user_id: customerId, error_code: 'LOYALTY_FRAUD_DETECTED' },
    });
  }
}
