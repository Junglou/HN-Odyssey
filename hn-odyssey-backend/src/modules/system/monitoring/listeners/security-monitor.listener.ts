import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { NotificationEvent } from 'src/modules/notifications/notification-policy.constant';
import { NotificationPriority } from 'src/modules/notifications/schemas/notification-log.schema';
import { EmailService } from 'src/modules/notifications/channels/email.service';
import {
  AuthSession,
  AuthSessionDocument,
} from '../schemas/auth-session.schema';
import { IntegrationLogDocument } from '../schemas/integration-log.schema';

export interface IntegrationApiCallPayload {
  provider: string;
  url: string;
  duration_ms: number;
  status_code: number;
  is_error: boolean;
  request_data: Record<string, unknown>;
  response_data: Record<string, unknown>;
}

@Injectable()
export class SecurityMonitorListener {
  private readonly logger = new Logger(SecurityMonitorListener.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    @InjectModel(AuthSession.name)
    private sessionModel: Model<AuthSessionDocument>,
    @InjectModel('IntegrationLog')
    private integrationLogModel: Model<IntegrationLogDocument>,
  ) {}

  // US3 - AC4: Spike Alert thanh toán (5 lỗi / 10 phút / cổng)
  // Đây là nơi DUY NHẤT đếm spike thanh toán (đã bỏ bộ đếm trùng ở PaymentMonitorListener)
  @OnEvent(NOTIFY_EVENTS.SYSTEM_ERROR)
  async handlePaymentFailureSpike(payload: {
    severity: string;
    error_code: string;
    message: string;
  }) {
    if (!payload?.error_code?.startsWith('PAYMENT_FAILED_')) return;

    const provider = payload.error_code.replace('PAYMENT_FAILED_', '');
    const redisKey = `spike:payment_fail:${provider}`;

    const failCount = await this.redis.incr(redisKey);
    if (failCount === 1) {
      await this.redis.expire(redisKey, 600);
    }

    if (failCount === 5) {
      this.logger.warn(
        `[SPIKE ALERT] Cổng ${provider} đang có tỷ lệ lỗi bất thường!`,
      );

      await this.notificationsService.notify(
        NotificationEvent.PAYMENT_GATEWAY_DOWN,
        {
          title: `Cổng thanh toán ${provider} lỗi liên tục`,
          message: `5 giao dịch thất bại trong 10 phút qua từ ${provider}. Kiểm tra cấu hình hoặc trạng thái bảo trì của đối tác.`,
          dedupeKey: `${NotificationEvent.PAYMENT_GATEWAY_DOWN}:${provider}`,
          metadata: { provider, gateway_error_code: payload.error_code },
        },
      );
    }
  }

  // US4 - AC3 & AC4: Đăng nhập từ thiết bị lạ & phiên đồng thời (không tạo thông báo Portal)
  @OnEvent('user.logged_in')
  async handleUserLogin(payload: {
    userId: string;
    email: string;
    ip: string;
    userAgent: string;
  }) {
    const fingerprint = crypto
      .createHash('md5')
      .update(`${payload.ip}-${payload.userAgent}`)
      .digest('hex');

    const existingSession = await this.sessionModel.findOne({
      user_id: new Types.ObjectId(payload.userId),
      device_fingerprint: fingerprint,
    });

    if (!existingSession) {
      await this.emailService.sendRaw(
        payload.email,
        '[Cảnh Báo Bảo Mật] Đăng nhập từ thiết bị lạ',
        `Tài khoản của bạn vừa được đăng nhập từ IP: ${payload.ip}, Trình duyệt: ${payload.userAgent}. Nếu không phải bạn, hãy đổi mật khẩu ngay.`,
      );
    }

    await this.sessionModel.updateMany(
      {
        user_id: new Types.ObjectId(payload.userId),
        device_fingerprint: { $ne: fingerprint },
      },
      { $set: { is_active: false } },
    );

    await this.sessionModel.findOneAndUpdate(
      {
        user_id: new Types.ObjectId(payload.userId),
        device_fingerprint: fingerprint,
      },
      {
        ip_address: payload.ip,
        user_agent: payload.userAgent,
        is_active: true,
        last_login_at: new Date(),
      },
      { upsert: true, new: true },
    );
  }

  // US4 - AC6: Đăng nhập thất bại hàng loạt (> 100 lần / phút trên toàn hệ thống)
  @OnEvent('user.login_failed')
  async handleDDoSLoginSpike() {
    const redisKey = 'spike:ddos_login_fail';
    const failCount = await this.redis.incr(redisKey);

    if (failCount === 1) {
      await this.redis.expire(redisKey, 60);
    }

    if (failCount === 100) {
      this.logger.error('[CRITICAL] Đăng nhập thất bại hàng loạt!');

      await this.notificationsService.notify(NotificationEvent.LOGIN_ATTACK, {
        title: 'Đăng nhập thất bại hàng loạt',
        message:
          'Hơn 100 lượt đăng nhập thất bại trên toàn hệ thống trong 1 phút qua. Khả năng cao đang bị dò mật khẩu.',
      });
    }
  }

  // US5 - AC4 & AC5: Ghi log tích hợp và giám sát hạn mức Twilio SMS
  @OnEvent('integration.api.called')
  async handleIntegrationApiCalled(payload: IntegrationApiCallPayload) {
    await this.integrationLogModel.create(payload).catch(() => {});

    if (payload.provider !== 'TWILIO_SMS' || payload.is_error) return;

    const QUOTA_LIMIT = 500;
    const currentMonth = new Date().toISOString().slice(0, 7); // VD: "2026-10"
    const quotaKey = `quota:twilio_sms:${currentMonth}`;
    const currentUsage = await this.redis.incr(quotaKey);

    const at80 = currentUsage === Math.floor(QUOTA_LIMIT * 0.8);
    const at90 = currentUsage === Math.floor(QUOTA_LIMIT * 0.9);

    if (at80 || at90) {
      // Cùng 1 khóa theo tháng: mốc 90% "leo thang" thông báo 80% thành CRITICAL,
      // không tạo thêm dòng mới trong chuông.
      await this.notificationsService.notify(NotificationEvent.SMS_QUOTA, {
        title: `Hạn mức SMS tháng ${currentMonth} đã dùng ${at90 ? '90' : '80'}%`,
        message: `Đã gửi ${currentUsage}/${QUOTA_LIMIT} tin nhắn Twilio. ${at90 ? 'Đăng ký / quên mật khẩu qua SĐT sắp bị gián đoạn.' : 'Cần nạp thêm hạn mức.'}`,
        priority: at90
          ? NotificationPriority.CRITICAL
          : NotificationPriority.HIGH,
        dedupeKey: `${NotificationEvent.SMS_QUOTA}:${currentMonth}`,
        metadata: { provider: 'TWILIO', current_usage: currentUsage },
      });
    } else if (currentUsage >= QUOTA_LIMIT && currentUsage % 50 === 0) {
      this.logger.error(
        `[QUOTA EXCEEDED] Twilio SMS đã vượt hạn mức: ${currentUsage}/${QUOTA_LIMIT}`,
      );
    }
  }
}
