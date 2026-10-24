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
import { NotificationEvent } from 'src/modules/notifications/notification-policy.constant';

// Payload chuẩn bắn ra từ IPN Handler của VNPAY/MOMO
export interface PaymentFailurePayload {
  provider: 'VNPAY' | 'MOMO';
  order_code: string;
  amount: number; // VNĐ — số tiền gửi sang cổng thanh toán
  error_code: string;
  error_message: string;
  raw_data: Record<string, any>;
}

@Injectable()
export class PaymentMonitorListener {
  private readonly logger = new Logger(PaymentMonitorListener.name);

  // Mã lỗi KỸ THUẬT (VNPAY): 99 ngoại lệ, 11 timeout, 07 trừ tiền nhưng giao dịch bị nghi ngờ
  private readonly TECH_ERRORS = ['99', '11', '07'];

  constructor(
    @InjectModel(IntegrationLog.name)
    private readonly integrationLogModel: Model<IntegrationLogDocument>,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent('payment.failed')
  async handlePaymentFailure(payload: PaymentFailurePayload) {
    this.logger.error(
      `[PAYMENT FAILED] Đơn ${payload.order_code} - Lỗi: ${payload.error_message}`,
    );

    // US3-AC1: Phân loại lỗi người dùng vs kỹ thuật
    const isTechError = this.TECH_ERRORS.includes(payload.error_code);
    const errorType = isTechError ? 'TECHNICAL_ERROR' : 'USER_ERROR';

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

    // Lỗi do người dùng (hủy, sai OTP, thiếu số dư...) không cần báo nhân sự
    if (!isTechError) return;

    // US3-AC2 & AC3: Lỗi kỹ thuật — gộp theo cổng thanh toán trong 30 phút
    const { isNew } = await this.notificationsService.notify(
      NotificationEvent.SYSTEM_ERROR,
      {
        title: `Lỗi kỹ thuật thanh toán ${payload.provider}`,
        message: `Đơn #${payload.order_code} (${payload.amount.toLocaleString('vi-VN')} VND) gặp sự cố: ${payload.error_message}`,
        dedupeKey: `${NotificationEvent.SYSTEM_ERROR}:PAYMENT_TECH_${payload.provider}`,
        metadata: {
          provider: payload.provider,
          order_code: payload.order_code,
          gateway_error_code: payload.error_code,
        },
      },
    );

    if (isNew) {
      await this.emailService.sendRaw(
        'admin@hn-odyssey.com',
        `[KHẨN] Sự cố thanh toán ${payload.provider}`,
        `Hệ thống ghi nhận lỗi kỹ thuật từ cổng thanh toán.\nMã đơn: ${payload.order_code}\nLý do: ${payload.error_message}\nMã lỗi: ${payload.error_code}`,
      );
    }

    // Spike (5 lỗi / 10 phút) do SecurityMonitorListener đếm từ sự kiện SYSTEM_ERROR.
    // Không đếm thêm ở đây để tránh 2 nơi cùng tăng một khóa Redis.
  }
}
