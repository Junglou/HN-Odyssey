import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  LoyaltyHistory,
  LoyaltyHistoryDocument,
} from 'src/modules/marketing/loyalty/schemas/loyalty-history.schema';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { NotificationEvent } from 'src/modules/notifications/notification-policy.constant';
import {
  Customer,
  CustomerDocument,
} from 'src/modules/users/customers/schemas/customer.schema';

@Injectable()
export class LoyaltyFraudListener {
  private readonly logger = new Logger(LoyaltyFraudListener.name);

  // Hệ USD (1$ = 1 điểm): 1 lần ≥ 5.000 điểm ≈ đơn ≥ $3.300 ở hạng Platinum (x1.5)
  private readonly FRAUD_THRESHOLD_AMOUNT = 5000;
  private readonly FRAUD_FREQUENCY_LIMIT = 5; // ≥ 5 lần tích điểm trong 1 giờ

  constructor(
    @InjectModel(LoyaltyHistory.name)
    private loyaltyModel: Model<LoyaltyHistoryDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Payload khớp với LoyaltyService.confirmPendingPoints: { userId, orderId, pointsAmount }
  @OnEvent('loyalty.points_earned')
  async handleEarnFraudDetection(data: {
    userId: string;
    orderId: string;
    pointsAmount: number;
  }) {
    try {
      const customer_id = data?.userId;
      const amount = Number(data?.pointsAmount) || 0;
      if (!customer_id || !Types.ObjectId.isValid(customer_id)) return;

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      if (amount >= this.FRAUD_THRESHOLD_AMOUNT) {
        await this.flagFraudUser(
          customer_id,
          `Nhận số điểm quá lớn bất thường: ${amount} điểm`,
        );
        return;
      }

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

    // new: true + select email: lấy email để trang Customers tìm đúng người
    const customer = await this.customerModel
      .findByIdAndUpdate(
        customerId,
        {
          $set: {
            internal_note: `[CẢNH BÁO GIAN LẬN HỆ THỐNG]: ${reason}`,
            status_reason: 'Tạm khóa do nghi ngờ gian lận Loyalty',
          },
        },
        { new: true },
      )
      .select('email')
      .lean<{ email?: string }>();

    const email = customer?.email;

    await this.notificationsService.notify(NotificationEvent.LOYALTY_FRAUD, {
      title: 'Nghi gian lận điểm thưởng',
      message: `Khách hàng ${email ?? `ID ${customerId}`}: ${reason}. Cần đối soát lịch sử tích điểm.`,
      dedupeKey: `${NotificationEvent.LOYALTY_FRAUD}:${customerId}`,
      targetUrl: email
        ? `/portal/customers?search=${encodeURIComponent(email)}`
        : undefined,
      // Dùng customer_id (không dùng user_id) để không bị đóng nhầm
      // bởi sự kiện resolve cảnh báo bảo mật theo user_id
      metadata: { customer_id: customerId, reason },
    });
  }
}
