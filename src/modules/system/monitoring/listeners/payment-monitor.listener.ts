import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IntegrationLog,
  IntegrationLogDocument,
} from '../schemas/integration-log.schema';
import { EmailService } from 'src/modules/notifications/channels/email.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import {
  NotificationType,
  NotificationPriority,
} from 'src/modules/notifications/schemas/notification-log.schema';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

// Payload chuẩn bắn ra từ IPN Handler của VNPAY/MOMO
export interface PaymentFailurePayload {
  provider: 'VNPAY' | 'MOMO';
  order_code: string;
  amount: number;
  error_code: string;
  error_message: string;
  raw_data: Record<string, any>;
}

@Injectable()
export class PaymentMonitorListener {
  private readonly logger = new Logger(PaymentMonitorListener.name);

  // Danh sách mã lỗi KỸ THUẬT (Ví dụ với VNPAY)
  // 99: Lỗi ngoại lệ, 11: Timeout, 07: Trừ tiền thành công nhưng gd bị nghi ngờ
  private readonly TECH_ERRORS = ['99', '11', '07'];

  constructor(
    @InjectModel(IntegrationLog.name)
    private readonly integrationLogModel: Model<IntegrationLogDocument>,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @OnEvent('payment.failed')
  async handlePaymentFailure(payload: PaymentFailurePayload) {
    this.logger.error(
      `[PAYMENT FAILED] Đơn ${payload.order_code} - Lỗi: ${payload.error_message}`,
    );

    // US3-AC1: PHÂN LOẠI LỖI NGƯỜI DÙNG vs KỸ THUẬT
    const isTechError = this.TECH_ERRORS.includes(payload.error_code);
    const errorType = isTechError ? 'TECHNICAL_ERROR' : 'USER_ERROR';

    // Lưu Log chi tiết
    await this.integrationLogModel.create({
      provider: payload.provider,
      url: 'Webhook/IPN',
      duration_ms: 0,
      status_code: 400,
      is_error: true,
      request_data: {
        order_code: payload.order_code,
        error_type: errorType,
      },
      response_data: payload.raw_data,
    });

    // US3-AC2 & AC3: GỬI THÔNG BÁO VÀ EMAIL ĐÚNG ĐỐI TƯỢNG
    if (isTechError) {
      // 1. Gửi Notification lên Dashboard
      await this.notificationsService.createAndSendToMultipleRoles({
        roles: ['SUPER_ADMIN', 'ADMIN'],
        title: `Lỗi kỹ thuật thanh toán ${payload.provider}`,
        message: `Đơn hàng #${payload.order_code} (${payload.amount.toLocaleString()}đ) gặp sự cố: ${payload.error_message}.`,
        type: NotificationType.SYSTEM,
        priority: NotificationPriority.HIGH,
        metadata: {
          order_code: payload.order_code,
          target_url: `/admin/orders?code=${payload.order_code}`, // Hành động khắc phục nhanh (AC5)
        },
      });

      // 2. Gửi Email cho Admin (Chỉ gửi khi lỗi kỹ thuật)
      await this.emailService.sendRaw(
        'admin@hn-odyssey.com', // Cấu hình lấy từ .env
        `[KHẨN] Sự cố thanh toán ${payload.provider}`,
        `Hệ thống ghi nhận lỗi kỹ thuật từ cổng thanh toán. \nMã đơn: ${payload.order_code}\nLý do: ${payload.error_message}\nMã lỗi: ${payload.error_code}`,
      );
    }

    // US3-AC4: KIỂM TRA SPIKE ALERT (Ngưỡng thất bại cao)
    await this.checkPaymentSpike(payload.provider);
  }

  private async checkPaymentSpike(provider: string) {
    const redisKey = `spike:payment_fail:${provider}`;
    const failCount = await this.redis.incr(redisKey);

    if (failCount === 1) {
      await this.redis.expire(redisKey, 600); // Reset sau 10 phút
    }

    if (failCount === 5) {
      await this.notificationsService.createAndSendToMultipleRoles({
        roles: ['SUPER_ADMIN'],
        title: `🔥 CẢNH BÁO KHẨN: Cổng ${provider} lỗi liên tục`,
        message: `Hệ thống ghi nhận 5 giao dịch thất bại liên tiếp trong 10 phút qua từ ${provider}. Có thể đối tác đang bảo trì hoặc sai cấu hình!`,
        type: NotificationType.SYSTEM,
        priority: NotificationPriority.CRITICAL,
        metadata: {
          target_url: `/admin/settings/payment-gateways?provider=${provider}`, // AC5
        },
      });
    }
  }
}
