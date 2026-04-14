import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications.service';
import { EmailService } from '../channels/email.service';
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

    // 2. Xử lý logic khóa tài khoản cho mức CRITICAL (Đã gỡ SMS)
    if (data.severity === 'CRITICAL' && data.user_id) {
      await this.usersService.updateStatus(data.user_id, {
        is_active: false,
        lock_reason: `Security Alert: ${data.message}`,
      });
    }

    // 3. Gửi Duy Nhất một thông báo hệ thống (Socket + DB)
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

  // XỬ LÝ SỰ KIỆN TỪ MODULE LOYALTY (US2 - AC17)
  @OnEvent('loyalty.points_earned')
  async handlePointsEarned(data: {
    userId: string;
    orderId: string;
    pointsAmount: number;
  }) {
    await this.notificationsService.createAndSend({
      recipient_role: 'CUSTOMER', // Bắn đích danh cho role Khách Hàng
      recipient_id: data.userId,
      title: 'Nhận điểm thưởng thành công! 🎉',
      message: `Bạn vừa được cộng thêm ${data.pointsAmount} điểm từ đơn hàng ${data.orderId}.`,
      type: NotificationType.LOYALTY, // Dùng đúng Type chuẩn xác
      priority: NotificationPriority.LOW, // Sự kiện bình thường
      metadata: { target_url: '/wallet/loyalty', order_id: data.orderId },
    });
  }

  @OnEvent('loyalty.tier_upgraded')
  async handleTierUpgraded(data: {
    userId: string;
    tierName: string;
    rewardValue: number;
    discountType: string;
  }) {
    const symbol = data.discountType === 'PERCENTAGE' ? '%' : 'đ';
    await this.notificationsService.createAndSend({
      recipient_role: 'CUSTOMER',
      recipient_id: data.userId,
      title: `Chúc mừng bạn đã lên hạng ${data.tierName}!`,
      message: `Bạn đã nhận được 1 Voucher giảm ${data.rewardValue}${symbol}. Kiểm tra Kho Voucher ngay nhé!`,
      type: NotificationType.LOYALTY,
      priority: NotificationPriority.HIGH, // Ưu tiên cao để đẩy nổi bật
      metadata: { target_url: '/wallet/vouchers' },
    });
  }

  @OnEvent('loyalty.reward_redeemed')
  async handleRewardRedeemed(data: {
    userId: string;
    pointsUsed: number;
    rewardType: string;
  }) {
    const itemName =
      data.rewardType === 'VOUCHER' ? 'Voucher giảm giá' : 'Quà tặng hiện vật';
    await this.notificationsService.createAndSend({
      recipient_role: 'CUSTOMER',
      recipient_id: data.userId,
      title: 'Đổi thưởng thành công!',
      message: `Bạn đã sử dụng ${data.pointsUsed} điểm để đổi ${itemName}.`,
      type: NotificationType.LOYALTY,
      priority: NotificationPriority.MEDIUM,
      metadata: { target_url: '/wallet/loyalty' },
    });
  }

  @OnEvent('loyalty.birthday_rewarded')
  async handleBirthdayRewarded(data: {
    userId: string;
    tier: string;
    voucherValue: number;
    hasPhysicalGift: boolean;
  }) {
    let message = `Tặng bạn Voucher ${data.voucherValue.toLocaleString()}đ mừng sinh nhật sắp tới. Hãy sử dụng ngay trong 30 ngày tới nhé!`;
    if (data.hasPhysicalGift) {
      message += ` Đặc biệt, cửa hàng có chuẩn bị một phần quà hiện vật cho hạng ${data.tier}, CSKH sẽ liên hệ bạn sớm!`;
    }

    await this.notificationsService.createAndSend({
      recipient_role: 'CUSTOMER',
      recipient_id: data.userId,
      title: 'Chúc mừng sinh nhật sớm!',
      message: message,
      type: NotificationType.LOYALTY,
      priority: NotificationPriority.HIGH,
      metadata: { target_url: '/wallet/vouchers', event: 'birthday' },
    });
  }
}
