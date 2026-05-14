import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import {
  AuthSession,
  AuthSessionDocument,
} from '../schemas/auth-session.schema';
import {
  NotificationType,
  NotificationPriority,
} from 'src/modules/notifications/schemas/notification-log.schema';
import * as crypto from 'crypto';
import { EmailService } from 'src/modules/notifications/channels/email.service';
import { IntegrationLogDocument } from '../schemas/integration-log.schema';

// BƯỚC 1: ĐỊNH NGHĨA INTERFACE ĐỂ KHỬ 'ANY'
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
    private integrationLogModel: Model<IntegrationLogDocument>, // Thêm dòng này
  ) {}

  // US3 - AC4: Bắt Spike Alert Thanh Toán (5 lỗi / 10 phút)
  @OnEvent(NOTIFY_EVENTS.SYSTEM_ERROR)
  async handlePaymentFailureSpike(payload: {
    severity: string;
    error_code: string;
    message: string;
  }) {
    if (!payload?.error_code?.startsWith('PAYMENT_FAILED_')) return;

    const provider = payload.error_code.replace('PAYMENT_FAILED_', '');
    const redisKey = `spike:payment_fail:${provider}`;

    // Tăng biến đếm
    const failCount = await this.redis.incr(redisKey);

    if (failCount === 1) {
      await this.redis.expire(redisKey, 600); // Reset bộ đếm sau 10 phút
    }

    if (failCount === 5) {
      this.logger.warn(
        `[SPIKE ALERT] Cổng ${provider} đang có tỷ lệ lỗi bất thường!`,
      );

      // AC5: Kèm Actionable Link
      await this.notificationsService.createAndSendToMultipleRoles({
        roles: ['SUPER_ADMIN'],
        title: `🔥 CẢNH BÁO KHẨN CẤP: Lỗi cổng thanh toán ${provider}`,
        message: `Hệ thống ghi nhận 5 giao dịch thất bại liên tiếp trong 10 phút qua từ ${provider}. Vui lòng kiểm tra lại cấu hình.`,
        type: NotificationType.SYSTEM,
        priority: NotificationPriority.CRITICAL,
        metadata: {
          error_code: payload.error_code,
          target_url: `/admin/settings/payment-gateways?provider=${provider}`, // Link khắc phục nhanh
        },
      });
    }
  }

  // US4 - AC3 & AC4: Giám sát đăng nhập từ thiết bị lạ & Concurrent Sessions
  @OnEvent('user.logged_in') // (Bạn cần bắn event này ở hàm Login trong AuthService)
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
      // AC3: Báo thiết bị lạ
      await this.emailService.sendRaw(
        payload.email,
        '[Cảnh Báo Bảo Mật] Đăng nhập từ thiết bị lạ',
        `Tài khoản của bạn vừa được đăng nhập từ IP: ${payload.ip}, Trình duyệt: ${payload.userAgent}. Nếu không phải bạn, hãy đổi mật khẩu ngay.`,
      );
    }

    // AC4: Quản lý phiên đăng nhập đồng thời (Xóa phiên cũ)
    await this.sessionModel.updateMany(
      {
        user_id: new Types.ObjectId(payload.userId),
        device_fingerprint: { $ne: fingerprint },
      },
      { $set: { is_active: false } },
    );

    // Lưu session mới
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

  // BỔ SUNG CHO US4 - AC6: Bắt DDoS Login diện rộng
  @OnEvent('user.login_failed') // Cần bắn sự kiện này ở AuthService khi sai pass
  async handleDDoSLoginSpike() {
    const redisKey = 'spike:ddos_login_fail';
    const failCount = await this.redis.incr(redisKey);

    if (failCount === 1) {
      await this.redis.expire(redisKey, 60); // Đo trong 1 phút (60s)
    }

    if (failCount === 100) {
      // AC6: > 100 lần thất bại/phút
      this.logger.error(
        '🚨 [CRITICAL] PHÁT HIỆN TẤN CÔNG DDOS VÀO CỔNG ĐĂNG NHẬP!',
      );

      await this.notificationsService.createAndSendToMultipleRoles({
        roles: ['SUPER_ADMIN'],
        warehouse_id: null as unknown as string,
        title: '🚨 Cảnh báo Tấn công DDoS',
        message:
          'Hệ thống ghi nhận hơn 100 lượt đăng nhập thất bại trên toàn hệ thống trong 1 phút qua. Khả năng cao đang bị tấn công.',
        type: NotificationType.SECURITY,
        priority: NotificationPriority.CRITICAL,
        metadata: {
          target_url: '/admin/system/audit-logs?action=LOGIN_FAILED',
        },
      });
    }
  }

  // US5 - AC4 & AC5: GHI LOG VÀ GIÁM SÁT HẠN MỨC (QUOTA) CỦA TWILIO SMS

  @OnEvent('integration.api.called')
  async handleIntegrationApiCalled(payload: IntegrationApiCallPayload) {
    // BƯỚC 2: THAY THẾ 'ANY' BẰNG INTERFACE
    // 1. Ghi log chi tiết (Thỏa mãn US5-AC5)
    await this.integrationLogModel.create(payload).catch(() => {});

    // 2. Đếm Quota nếu đây là dịch vụ TWILIO_SMS và gửi thành công (Thỏa mãn US5-AC4)
    if (payload.provider === 'TWILIO_SMS' && !payload.is_error) {
      const QUOTA_LIMIT = 500; // Giả sử giới hạn ngân sách là 500 tin nhắn/tháng (bạn có thể đưa vào .env)
      const currentMonth = new Date().toISOString().slice(0, 7); // VD: "2025-11"
      const quotaKey = `quota:twilio_sms:${currentMonth}`;

      const currentUsage = await this.redis.incr(quotaKey);

      // Cảnh báo AC4: Đạt mốc 80%, 90%, 100%
      if (currentUsage === Math.floor(QUOTA_LIMIT * 0.8)) {
        await this.notificationsService.createAndSendToMultipleRoles({
          roles: ['SUPER_ADMIN', 'ADMIN'],
          title: '⚠️ Cảnh báo: Hạn mức SMS sắp hết (80%)',
          message: `Hệ thống đã gửi ${currentUsage}/${QUOTA_LIMIT} tin nhắn Twilio trong tháng này. Vui lòng nạp thêm tiền.`,
          type: NotificationType.SYSTEM,
          priority: NotificationPriority.HIGH,
          metadata: { provider: 'TWILIO', current_usage: currentUsage },
        });
      } else if (currentUsage === Math.floor(QUOTA_LIMIT * 0.9)) {
        await this.notificationsService.createAndSendToMultipleRoles({
          roles: ['SUPER_ADMIN', 'ADMIN'],
          title: '🚨 Cảnh báo Khẩn: Hạn mức SMS đạt 90%',
          message: `Hệ thống đã gửi ${currentUsage}/${QUOTA_LIMIT} tin nhắn Twilio. Tính năng đăng ký/quên mật khẩu qua SĐT sắp bị gián đoạn!`,
          type: NotificationType.SYSTEM,
          priority: NotificationPriority.CRITICAL,
          metadata: { provider: 'TWILIO', current_usage: currentUsage },
        });
      } else if (currentUsage >= QUOTA_LIMIT && currentUsage % 50 === 0) {
        // Vượt 100%, cứ lố 50 tin nhắn báo lại 1 lần
        this.logger.error(
          `[QUOTA EXCEEDED] Twilio SMS đã vượt hạn mức: ${currentUsage}/${QUOTA_LIMIT}`,
        );
      }
    }
  }
}
