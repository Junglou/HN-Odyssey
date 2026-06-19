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
import { TradeInStatus } from 'src/common/enums/trade-in.enum';

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

interface TradeInAcceptedPayload {
  request_id: string;
  customer_id: string;
  product_name: string;
  final_value: number;
  rma_order_code: string;
}

export interface TradeInSocketPayload {
  requestCode: string;
  status: TradeInStatus;
}

interface TicketCreatedPayload {
  email: string;
  ticketId: string;
  content: string;
}

interface TradeInCompletedPayload {
  request_id: string;
  customer_id: string;
  payout_method: string;
  final_value: number;
  voucher_code?: string;
}

interface TradeInCreatedPayload {
  request_id: string;
  customer_id: string;
  product_name: string;
  estimated_value: number;
}

interface TradeInRenegotiatePayload {
  request_id: string;
  customer_id: string;
  proposed_price: number;
}

interface TradeInInspectedPayload {
  request_id: string;
  customer_id: string;
  final_value: number;
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

    // Gửi email cảnh báo
    await this.emailService.sendRaw(
      adminEmail,
      `[BẢO MẬT] Cảnh báo mức độ ${data.severity}`,
      `Chi tiết: ${data.message}\n- IP: ${data.ip || 'N/A'}\n- User ID: ${data.user_id || 'N/A'}`,
    );

    // Xác định xem tài khoản có thỏa mãn điều kiện bị khóa hay không
    const isAccountLocked = data.severity === 'CRITICAL' && data.user_id;

    // Xử lý logic khóa tài khoản cho mức critical
    if (isAccountLocked && data.user_id) {
      await this.usersService.updateStatus(data.user_id, {
        is_active: false,
        lock_reason: `Security Alert: ${data.message}`,
      });
    }

    // Gửi duy nhất một thông báo hệ thống (Socket + DB)
    await this.notificationsService.createAndSend({
      recipient_role: 'SUPER_ADMIN',
      warehouse_id: undefined, // Admin nhận diện rộng, không phân kho
      title: isAccountLocked
        ? 'Tài khoản đã bị tạm khóa'
        : 'Cảnh báo bảo mật: Mức độ nghiêm trọng',
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
        target_url: '/portal/system',
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
      metadata: {
        error_code: data.error_code,
        stack: data.stack_trace,
        target_url: '/portal/system',
      },
    });
  }

  // Xử lý sự kiện từ module loyalty (US2 - AC17)
  @OnEvent('loyalty.points_earned')
  async handlePointsEarned(data: {
    userId: string;
    orderId: string;
    pointsAmount: number;
  }) {
    await this.notificationsService.createAndSend({
      recipient_role: 'CUSTOMER',
      recipient_id: data.userId,
      title: 'Nhận điểm thưởng thành công!',
      message: `Bạn vừa được cộng thêm ${data.pointsAmount} điểm từ đơn hàng ${data.orderId}.`,
      type: NotificationType.LOYALTY,
      priority: NotificationPriority.LOW,
      metadata: { target_url: '/profile/loyalty', order_id: data.orderId },
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
      priority: NotificationPriority.HIGH,
      metadata: { target_url: '/profile/coupon' },
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
      metadata: { target_url: '/profile/loyalty' },
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
      metadata: { target_url: '/profile/coupon', event: 'birthday' },
    });
  }

  @OnEvent('notify.trade_in.accepted')
  async handleTradeInAccepted(data: TradeInAcceptedPayload) {
    await this.notificationsService.createAndSend({
      recipient_role: 'CUSTOMER',
      recipient_id: data.customer_id,
      title: 'Yêu cầu thu cũ đã được chấp thuận!',
      message: `Sản phẩm ${data.product_name} đã được định giá ${data.final_value}đ. Mã vận đơn ngược: ${data.rma_order_code}. Shipper sẽ sớm liên hệ bạn!`,
      type: NotificationType.ORDER,
      priority: NotificationPriority.HIGH,
      metadata: { target_url: '/profile/orders' },
    });
  }

  @OnEvent('notify.trade_in.completed')
  async handleTradeInCompleted(data: TradeInCompletedPayload) {
    const isVoucher = data.payout_method === 'VOUCHER';
    const msg = isVoucher
      ? `Đã gửi Voucher trị giá ${data.final_value}đ (Mã: ${data.voucher_code}) vào ví của bạn.`
      : `Đã chuyển khoản thành công ${data.final_value}đ vào tài khoản ngân hàng của bạn.`;

    await this.notificationsService.createAndSend({
      recipient_role: 'CUSTOMER',
      recipient_id: data.customer_id,
      title: 'Hoàn tất thanh toán Thu cũ!',
      message: msg,
      type: NotificationType.ORDER,
      priority: NotificationPriority.HIGH,
      metadata: { target_url: '/profile/orders' },
    });
  }

  @OnEvent('notify.trade_in.created')
  async handleTradeInCreated(data: TradeInCreatedPayload) {
    await this.notificationsService.createAndSend({
      recipient_role: 'CUSTOMER',
      recipient_id: data.customer_id,
      title: 'Yêu cầu thu cũ đã gửi thành công',
      message: `Hệ thống đã tiếp nhận yêu cầu thu mua sản phẩm ${data.product_name}. Định giá sơ bộ: ${data.estimated_value.toLocaleString()}đ.`,
      type: NotificationType.ORDER,
      priority: NotificationPriority.MEDIUM,
      metadata: { target_url: '/profile/orders' },
    });
  }

  @OnEvent('notify.trade_in.renegotiate')
  async handleTradeInRenegotiate(data: TradeInRenegotiatePayload) {
    await this.notificationsService.createAndSend({
      recipient_role: 'CUSTOMER',
      recipient_id: data.customer_id,
      title: 'Có thay đổi về định giá Thu cũ (Cần xác nhận)',
      message: `Sản phẩm của bạn có sai lệch tình trạng sau khi kiểm định tại kho. Đề xuất giá mới: ${data.proposed_price.toLocaleString()}đ. Vui lòng kiểm tra và xác nhận!`,
      type: NotificationType.ORDER,
      priority: NotificationPriority.HIGH,
      metadata: { target_url: '/profile/orders' },
    });
  }

  @OnEvent('notify.trade_in.inspected')
  async handleTradeInInspected(data: TradeInInspectedPayload) {
    await this.notificationsService.createAndSend({
      recipient_role: 'CUSTOMER',
      recipient_id: data.customer_id,
      title: 'Sản phẩm đã qua kiểm định!',
      message: `Tuyệt vời! Sản phẩm của bạn khớp hoàn toàn với mô tả. Đã chốt giá thu mua: ${data.final_value.toLocaleString()}đ.`,
      type: NotificationType.ORDER,
      priority: NotificationPriority.HIGH,
      metadata: { target_url: '/profile/orders' },
    });
  }

  @OnEvent('support.ticket_created')
  async handleTicketCreated(data: TicketCreatedPayload) {
    this.logger.log(
      `[Support] Bắt đầu xử lý thông báo cho Ticket mới từ: ${data.email}`,
    );

    // Bắn thông báo in-app cho nhân viên cskh
    await this.notificationsService.createAndSend({
      recipient_role: 'SUPPORT_STAFF',
      title: 'Có yêu cầu hỗ trợ mới (Offline Ticket)',
      message: `Khách hàng (${data.email}) vừa gửi lời nhắn: "${data.content.substring(0, 50)}..."`,
      type: NotificationType.SYSTEM,
      priority: NotificationPriority.HIGH,
      metadata: { target_url: '/portal/live-chat' },
    });

    // Gửi email thông báo cho trưởng bộ phận
    const supportEmail =
      this.configService.get<string>('MAIL_SUPPORT_RECEIVER') ||
      'support@hn-odyssey.com';

    await this.emailService.sendRaw(
      supportEmail,
      `[H&N Odyssey - CSKH] Ticket hỗ trợ mới từ ${data.email}`,
      `Hệ thống vừa ghi nhận một Ticket hỗ trợ Offline.\n\n- Khách hàng: ${data.email}\n- Nội dung: ${data.content}\n- Link xử lý: /portal/live-chat`,
    );
  }
}
