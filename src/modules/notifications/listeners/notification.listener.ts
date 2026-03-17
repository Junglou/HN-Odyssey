import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications.service';
import { EmailService } from '../channels/email.service';
import { SmsService } from '../channels/sms.service';
import {
  NotificationType,
  NotificationPriority,
} from '../schemas/notification-log.schema';
import { Order } from 'src/modules/sales/orders/schemas/order.schema';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { WebhookService } from '../channels/webhook.service';
import { UsersService } from 'src/modules/users/user.Service';

interface StockAlertPayload {
  product: { _id: string; name: string; warehouse_id: string };
  variant: { sku: string };
  type: 'MIN' | 'MAX';
  currentStock: number;
}

interface SecurityAlertPayload {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  message: string;
  user_id?: string;
  ip?: string;
}

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
    private readonly webhookService: WebhookService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  @OnEvent(NOTIFY_EVENTS.ORDER_CREATED)
  async handleOrderCreatedEvent(order: Order) {
    try {
      await this.notificationsService.pushToOrderStream(order);
      const salesEmail =
        this.configService.get<string>('MAIL_SALES_RECEIVER') ||
        'dghkl098@gmail.com';
      await this.emailService.sendRaw(
        salesEmail,
        `[H&N Odyssey] Đơn hàng mới #${order.order_code}`,
        `Khách hàng: ${order.shipping_info?.name || 'Khách'} - Tổng: ${(order.total_amount || 0).toLocaleString()}đ`,
      );
    } catch (error) {
      this.logger.error('Error handling order created event', error);
    }
  }

  @OnEvent(NOTIFY_EVENTS.STOCK_ALERT)
  async handleStockAlertEvent(data: StockAlertPayload) {
    console.log(
      `[DEBUG LISTENER] Đã nhận được tin báo từ StockService cho SKU: ${data.variant.sku}`,
    );
    const { product, variant, type, currentStock } = data;
    const title =
      type === 'MIN' ? 'Cảnh báo: Sắp hết hàng' : 'Cảnh báo: Dư thừa tồn kho';
    const alertMessage = `Sản phẩm ${product.name} (${variant.sku}) hiện có ${currentStock} sp.`;

    await this.notificationsService.createAndSendToMultipleRoles({
      roles: ['WAREHOUSE_STAFF', 'WAREHOUSE_MANAGER', 'SUPER_ADMIN'],
      warehouse_id: product.warehouse_id,
      title,
      message: alertMessage,
      type: NotificationType.STOCK,
      priority: NotificationPriority.HIGH,
      metadata: { sku: variant.sku, product_id: product._id },
    });

    if (type === 'MIN') {
      const managerEmail =
        this.configService.get<string>('MAIL_WAREHOUSE_MANAGER') ||
        'manager@hn-odyssey.com';
      await this.emailService.sendRaw(
        managerEmail,
        `[KHO] CẢNH BÁO TỒN KHO THẤP - ${variant.sku}`,
        alertMessage,
      );
    }
  }

  @OnEvent(NOTIFY_EVENTS.SECURITY_ALERT)
  async handleSecurityAlert(data: SecurityAlertPayload) {
    const adminEmail =
      this.configService.get<string>('MAIL_ADMIN_RECEIVER') ||
      'admin@hn-odyssey.com';

    // 1. Gửi Email cảnh báo
    await this.emailService.sendRaw(
      adminEmail,
      `[BẢO MẬT] Cảnh báo mức độ ${data.severity}`,
      `Chi tiết: ${data.message}\n- IP: ${data.ip || 'N/A'}\n- User ID: ${data.user_id || 'N/A'}`,
    );

    // 2. Xử lý logic khóa tài khoản và SMS cho mức CRITICAL
    if (data.severity === 'CRITICAL' && data.user_id) {
      const adminPhone =
        this.configService.get<string>('ADMIN_PHONE_NUMBER') || '0987654321';

      // Thực hiện các tác vụ chặn song song để tối ưu tốc độ phản ứng
      await Promise.all([
        this.usersService.updateStatus(data.user_id, {
          is_active: false,
          lock_reason: `Security Alert: ${data.message}`,
        }),
        this.smsService
          .sendOtp(
            adminPhone,
            `[CRITICAL] Phat hien rui ro bao mat cho User: ${data.user_id}. Kiem tra ngay!`,
          )
          .catch(() => {}),
      ]);
    }

    // 3. Gửi Duy Nhất một thông báo hệ thống (Socket + DB)
    // Title và Priority được quyết định dựa trên Severity
    await this.notificationsService.createAndSend({
      recipient_role: 'SUPER_ADMIN',
      warehouse_id: undefined, // Admin nhận diện rộng, không phân kho
      title:
        data.severity === 'CRITICAL'
          ? 'Tài khoản đã bị tạm khóa'
          : 'Cảnh báo bảo mật',
      message: data.message,
      type: NotificationType.SECURITY,
      priority:
        data.severity === 'CRITICAL'
          ? NotificationPriority.CRITICAL
          : NotificationPriority.HIGH,
      metadata: {
        severity: data.severity,
        user_id: data.user_id,
        ip: data.ip,
        target_url: data.user_id
          ? `/admin/system/audit-logs?userId=${data.user_id}`
          : `/admin/system/audit-logs`,
      },
    });
  }

  @OnEvent('notification.stock.resolve')
  async handleStockResolve(data: { sku: string }) {
    await this.notificationsService.autoResolveStockAlert(data.sku);
  }

  @OnEvent('notification.system.resolve')
  async handleSystemResolve(data: { error_code: string }) {
    await this.notificationsService.autoResolveAlert(
      NotificationType.SYSTEM,
      'error_code',
      data.error_code,
    );
  }

  @OnEvent('notification.security.resolve')
  async handleSecurityResolve(data: { user_id?: string; ip?: string }) {
    if (data.user_id) {
      await this.notificationsService.autoResolveAlert(
        NotificationType.SECURITY,
        'user_id',
        data.user_id,
      );
    }
    if (data.ip) {
      await this.notificationsService.autoResolveAlert(
        NotificationType.SECURITY,
        'ip',
        data.ip,
      );
    }
  }

  @OnEvent(NOTIFY_EVENTS.SYSTEM_ERROR)
  async handleSystemError(data: {
    error_code: string;
    message: string;
    stack_trace?: string;
    severity: string;
  }) {
    const adminEmail = this.configService.get<string>('MAIL_ADMIN_RECEIVER');
    if (adminEmail) {
      await this.emailService.sendRaw(
        adminEmail,
        `[HỆ THỐNG] Lỗi ${data.error_code}`,
        `Chi tiết: ${data.message}`,
      );
    }

    if (data.severity === 'CRITICAL') {
      await this.webhookService.sendToSlackOrTeams(
        `Mã lỗi: ${data.error_code} - ${data.message}`,
        data.severity,
      );

      const adminPhone =
        this.configService.get<string>('ADMIN_PHONE_NUMBER') || '0987654321';
      await this.smsService
        .sendOtp(
          adminPhone,
          `[CRITICAL] He thong xay ra loi nghiem trong: ${data.error_code}. Kiem tra ngay!`,
        )
        .catch((e) => this.logger.error('Lỗi gửi SMS CRITICAL', e));
    }

    await this.notificationsService.createAndSend({
      recipient_role: 'SUPER_ADMIN',
      title: `Lỗi Vận Hành: ${data.error_code}`,
      message: data.message,
      type: NotificationType.SYSTEM,
      priority:
        data.severity === 'CRITICAL'
          ? NotificationPriority.CRITICAL
          : NotificationPriority.HIGH,
      metadata: { error_code: data.error_code, stack: data.stack_trace },
    });
  }
}
