import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications.service';
import { EmailService } from '../channels/email.service';
import {
  NotificationType,
  NotificationPriority,
  NotificationScope,
} from '../schemas/notification-log.schema';
import { NotificationEvent } from '../notification-policy.constant';
import { Order } from 'src/modules/sales/orders/schemas/order.schema';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { WebhookService } from '../channels/webhook.service';
import { UsersService } from 'src/modules/users/user.Service';
import { TradeInStatus } from 'src/common/enums/trade-in.enum';
import {
  CHAT_DEPARTMENT_LABELS,
  SUPPORT_EVENTS,
} from 'src/modules/support/chat/chat.events';
import type {
  ChatAcceptedPayload,
  HandoffCreatedPayload,
} from 'src/modules/support/chat/chat.events';

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
  request_code: string;
  customer_id: string;
  product_name: string;
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

const SEVERITY_TO_PRIORITY: Record<
  SecurityAlertPayload['severity'],
  NotificationPriority
> = {
  CRITICAL: NotificationPriority.CRITICAL,
  HIGH: NotificationPriority.HIGH,
  MEDIUM: NotificationPriority.MEDIUM,
};

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

  // A. THÔNG BÁO CHO NHÂN SỰ (Portal) — gửi theo quyền, xem NOTIFICATION_POLICIES

  @OnEvent(NOTIFY_EVENTS.ORDER_CREATED)
  async handleOrderCreatedEvent(order: Order) {
    // Thông báo + email cho Sales đều được gộp theo cửa sổ 10 giây trong NotificationsService
    await this.notificationsService.pushToOrderStream(order);
  }

  // Đơn rời trạng thái chờ xác nhận → thông báo "đơn mới" chuyển Resolved cho cả nhóm Sales
  @OnEvent('order.status_changed')
  async handleOrderStatusChanged(data: {
    orderId: string;
    oldStatus: string;
    newStatus: string;
  }) {
    const WAITING = ['TEMPORARY', 'PENDING', 'PRIORITY'];
    if (WAITING.includes(data.oldStatus) && !WAITING.includes(data.newStatus)) {
      await this.notificationsService.resolveOrderHandled(data.orderId);
    }
  }

  @OnEvent(NOTIFY_EVENTS.STOCK_ALERT)
  async handleStockAlertEvent(data: StockAlertPayload) {
    const { product, variant, type, currentStock } = data;
    const isLow = type === 'MIN';
    const event = isLow
      ? NotificationEvent.STOCK_LOW
      : NotificationEvent.STOCK_OVER;

    const message = `${product.name} (${variant.sku}) hiện còn ${currentStock} sản phẩm.`;

    // Tồn kho có thể nhảy thẳng từ "sắp hết" sang "dư thừa" (nhập lô lớn) hoặc ngược lại:
    // cảnh báo trái chiều không còn đúng nữa nên đóng lại.
    const opposite = isLow
      ? NotificationEvent.STOCK_OVER
      : NotificationEvent.STOCK_LOW;
    await this.notificationsService.resolveWhere({
      dedupe_key: `${opposite}:${variant.sku}`,
    });

    const { isNew } = await this.notificationsService.notify(event, {
      title: isLow ? 'Sắp hết hàng' : 'Tồn kho vượt mức tối đa',
      message,
      dedupeKey: `${event}:${variant.sku}`,
      // Sắp hết hàng → màn hình xử lý kho; dư thừa giữ trang báo cáo mặc định của policy
      targetUrl: isLow
        ? `/portal/warehouse?sku=${encodeURIComponent(variant.sku)}`
        : undefined,
      metadata: {
        sku: variant.sku,
        product_id: String(product._id),
        current_stock: currentStock,
      },
    });

    // Chỉ gửi email ở lần đầu, các lần lặp lại đã được gộp thì không gửi nữa
    if (isLow && isNew) {
      const managerEmail =
        this.configService.get<string>('MAIL_WAREHOUSE_MANAGER') ||
        'manager@hn-odyssey.com';
      await this.emailService.sendRaw(
        managerEmail,
        `[KHO] CẢNH BÁO TỒN KHO THẤP - ${variant.sku}`,
        message,
      );
    }
  }

  @OnEvent(NOTIFY_EVENTS.SECURITY_ALERT)
  async handleSecurityAlert(data: SecurityAlertPayload) {
    const shouldLock = data.severity === 'CRITICAL' && !!data.user_id;

    if (shouldLock && data.user_id) {
      await this.usersService.updateStatus(data.user_id, {
        is_active: false,
        lock_reason: `Security Alert: ${data.message}`,
      });
    }

    const metadata = {
      severity: data.severity,
      user_id: data.user_id,
      ip: data.ip,
    };

    const { isNew } = shouldLock
      ? await this.notificationsService.notify(
          NotificationEvent.ACCOUNT_LOCKED,
          {
            title: 'Tài khoản bị khóa tự động',
            message: data.message,
            dedupeKey: `${NotificationEvent.ACCOUNT_LOCKED}:${data.user_id}`,
            metadata,
          },
        )
      : await this.notificationsService.notify(
          NotificationEvent.SECURITY_ALERT,
          {
            title: `Cảnh báo bảo mật mức ${data.severity}`,
            message: data.message,
            priority: SEVERITY_TO_PRIORITY[data.severity],
            dedupeKey: `${NotificationEvent.SECURITY_ALERT}:${data.user_id ?? data.ip ?? 'unknown'}`,
            metadata,
          },
        );

    if (isNew) {
      const adminEmail =
        this.configService.get<string>('MAIL_ADMIN_RECEIVER') ||
        'admin@hn-odyssey.com';
      await this.emailService.sendRaw(
        adminEmail,
        `[BẢO MẬT] Cảnh báo mức độ ${data.severity}`,
        `Chi tiết: ${data.message}\n- IP: ${data.ip || 'N/A'}\n- User ID: ${data.user_id || 'N/A'}`,
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
    const isCritical = data.severity === 'CRITICAL';

    const { isNew } = await this.notificationsService.notify(
      NotificationEvent.SYSTEM_ERROR,
      {
        title: `Lỗi vận hành: ${data.error_code}`,
        message: data.message,
        priority: isCritical
          ? NotificationPriority.CRITICAL
          : NotificationPriority.HIGH,
        dedupeKey: `${NotificationEvent.SYSTEM_ERROR}:${data.error_code}`,
        // Không gửi stack trace xuống trình duyệt
        metadata: { error_code: data.error_code },
      },
    );

    // Lỗi lặp lại trong 30 phút chỉ tăng bộ đếm, không gửi email/webhook thêm
    if (!isNew) return;

    const adminEmail = this.configService.get<string>('MAIL_ADMIN_RECEIVER');
    if (adminEmail) {
      await this.emailService.sendRaw(
        adminEmail,
        `[HỆ THỐNG] Lỗi ${data.error_code}`,
        `Chi tiết: ${data.message}`,
      );
    }

    if (isCritical) {
      await this.webhookService.sendToSlackOrTeams(
        `Mã lỗi: ${data.error_code} - ${data.message}`,
        data.severity,
      );
    }
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

  @OnEvent('support.ticket_created')
  async handleTicketCreated(data: TicketCreatedPayload) {
    await this.notificationsService.notify(NotificationEvent.SUPPORT_TICKET, {
      title: 'Yêu cầu hỗ trợ offline mới',
      message: `${data.email}: "${data.content.substring(0, 80)}${data.content.length > 80 ? '…' : ''}"`,
      targetUrl: `/portal/live-chat?conversationId=${String(data.ticketId)}`,
      metadata: { ticket_id: String(data.ticketId) },
    });

    const supportEmail =
      this.configService.get<string>('MAIL_SUPPORT_RECEIVER') ||
      'support@hn-odyssey.com';

    await this.emailService.sendRaw(
      supportEmail,
      `[H&N Odyssey - CSKH] Ticket hỗ trợ mới từ ${data.email}`,
      `Hệ thống vừa ghi nhận một Ticket hỗ trợ Offline.\n\n- Khách hàng: ${data.email}\n- Nội dung: ${data.content}\n- Link xử lý: ${this.getFrontendUrl()}/portal/live-chat`,
    );
  }

  @OnEvent(SUPPORT_EVENTS.HANDOFF_CREATED)
  async handleChatHandoff(data: HandoffCreatedPayload) {
    const departmentLabel =
      CHAT_DEPARTMENT_LABELS[data.department] || data.department;

    const { isNew } = await this.notificationsService.notify(
      NotificationEvent.CHAT_HANDOFF,
      {
        title: `Khách đang chờ hỗ trợ trực tiếp (${departmentLabel})`,
        message: `${data.customerName}: ${(data.summary || '').substring(0, 80)}`,
        dedupeKey: `${NotificationEvent.CHAT_HANDOFF}:${data.conversationId}`,
        targetUrl: `/portal/live-chat?conversationId=${data.conversationId}`,
        metadata: { conversation_id: data.conversationId },
      },
    );

    if (!isNew) return;

    try {
      await this.emailService.sendHandoffAlertToDepartment(
        this.getDepartmentMailReceiver(data.department),
        {
          departmentLabel,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          summary: data.summary,
          portalUrl: `${this.getFrontendUrl()}/portal/live-chat`,
        },
      );
    } catch (error) {
      this.logger.error('[Support] Lỗi gửi mail handoff cho bộ phận', error);
    }
  }

  // B. THÔNG BÁO CHO KHÁCH HÀNG — gửi đích danh, không hiện trong Portal

  @OnEvent('loyalty.points_earned')
  async handlePointsEarned(data: {
    userId: string;
    orderId: string;
    pointsAmount: number;
  }) {
    await this.notificationsService.notifyUser(data.userId, {
      scope: NotificationScope.CUSTOMER,
      type: NotificationType.LOYALTY,
      priority: NotificationPriority.LOW,
      title: 'Nhận điểm thưởng thành công!',
      message: `Bạn vừa được cộng thêm ${data.pointsAmount} điểm từ đơn hàng ${data.orderId}.`,
      targetUrl: '/profile/loyalty',
      metadata: { order_id: data.orderId },
    });
  }

  @OnEvent('loyalty.tier_upgraded')
  async handleTierUpgraded(data: {
    userId: string;
    tierName: string;
    rewardValue: number;
    discountType: string;
  }) {
    const reward =
      data.discountType === 'PERCENTAGE'
        ? `${data.rewardValue}%`
        : `$${data.rewardValue}`;
    await this.notificationsService.notifyUser(data.userId, {
      scope: NotificationScope.CUSTOMER,
      type: NotificationType.LOYALTY,
      priority: NotificationPriority.HIGH,
      title: `Chúc mừng bạn đã lên hạng ${data.tierName}!`,
      message: `Bạn đã nhận được 1 Voucher giảm ${reward}. Kiểm tra Kho Voucher ngay nhé!`,
      targetUrl: '/profile/coupon',
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
    await this.notificationsService.notifyUser(data.userId, {
      scope: NotificationScope.CUSTOMER,
      type: NotificationType.LOYALTY,
      priority: NotificationPriority.MEDIUM,
      title: 'Đổi thưởng thành công!',
      message: `Bạn đã sử dụng ${data.pointsUsed} điểm để đổi ${itemName}.`,
      targetUrl: '/profile/loyalty',
    });
  }

  @OnEvent('loyalty.birthday_rewarded')
  async handleBirthdayRewarded(data: {
    userId: string;
    tier: string;
    voucherValue: number;
    hasPhysicalGift: boolean;
  }) {
    let message = `Tặng bạn Voucher $${data.voucherValue.toLocaleString('en-US')} mừng sinh nhật sắp tới. Hãy sử dụng trong 30 ngày tới nhé!`;
    if (data.hasPhysicalGift) {
      message += ` Cửa hàng có chuẩn bị một phần quà hiện vật cho hạng ${data.tier}, CSKH sẽ liên hệ bạn sớm!`;
    }

    await this.notificationsService.notifyUser(data.userId, {
      scope: NotificationScope.CUSTOMER,
      type: NotificationType.LOYALTY,
      priority: NotificationPriority.HIGH,
      title: 'Chúc mừng sinh nhật sớm!',
      message,
      targetUrl: '/profile/coupon',
      metadata: { event: 'birthday' },
    });
  }

  @OnEvent('notify.trade_in.accepted')
  async handleTradeInAccepted(data: TradeInAcceptedPayload) {
    await this.notificationsService.notifyUser(data.customer_id, {
      scope: NotificationScope.CUSTOMER,
      type: NotificationType.ORDER,
      priority: NotificationPriority.HIGH,
      title: 'Yêu cầu thu cũ đã được chấp thuận!',
      message: `Sản phẩm ${data.product_name} đã được định giá $${data.final_value.toLocaleString('en-US')}. Mã vận đơn ngược: ${data.rma_order_code}. Shipper sẽ sớm liên hệ bạn!`,
      targetUrl: '/profile/orders',
    });
  }

  @OnEvent('notify.trade_in.completed')
  async handleTradeInCompleted(data: TradeInCompletedPayload) {
    const value = `$${data.final_value.toLocaleString('en-US')}`;
    const msg =
      data.payout_method === 'VOUCHER'
        ? `Đã gửi Voucher trị giá ${value} (Mã: ${data.voucher_code}) vào ví của bạn.`
        : `Đã chuyển khoản thành công ${value} vào tài khoản ngân hàng của bạn.`;

    await this.notificationsService.notifyUser(data.customer_id, {
      scope: NotificationScope.CUSTOMER,
      type: NotificationType.ORDER,
      priority: NotificationPriority.HIGH,
      title: 'Hoàn tất thanh toán Thu cũ!',
      message: msg,
      targetUrl: '/profile/orders',
    });
  }

  @OnEvent('notify.trade_in.created')
  async handleTradeInCreated(data: TradeInCreatedPayload) {
    // Lúc vừa tạo chưa có định giá (estimated_value = 0) nên không nhắc tới giá
    await this.notificationsService.notifyUser(data.customer_id, {
      scope: NotificationScope.CUSTOMER,
      type: NotificationType.ORDER,
      priority: NotificationPriority.MEDIUM,
      title: 'Yêu cầu thu cũ đã gửi thành công',
      message: `Yêu cầu ${data.request_code} cho sản phẩm ${data.product_name} đã được tiếp nhận. Cửa hàng sẽ định giá và phản hồi sớm.`,
      targetUrl: '/profile/orders',
      metadata: { request_code: data.request_code },
    });

    await this.notificationsService.notify(NotificationEvent.TRADE_IN_NEW, {
      title: 'Yêu cầu thu cũ mới cần định giá',
      message: `${data.request_code} — ${data.product_name}`,
      targetUrl: `/portal/trade-in?search=${encodeURIComponent(data.request_code)}`,
      metadata: {
        request_id: data.request_id,
        request_code: data.request_code,
      },
    });
  }

  @OnEvent('notify.trade_in.renegotiate')
  async handleTradeInRenegotiate(data: TradeInRenegotiatePayload) {
    await this.notificationsService.notifyUser(data.customer_id, {
      scope: NotificationScope.CUSTOMER,
      type: NotificationType.ORDER,
      priority: NotificationPriority.HIGH,
      title: 'Có thay đổi về định giá Thu cũ (Cần xác nhận)',
      message: `Sản phẩm của bạn có sai lệch tình trạng sau khi kiểm định tại kho. Đề xuất giá mới: $${data.proposed_price.toLocaleString('en-US')}. Vui lòng kiểm tra và xác nhận!`,
      targetUrl: '/profile/orders',
    });
  }

  @OnEvent('notify.trade_in.inspected')
  async handleTradeInInspected(data: TradeInInspectedPayload) {
    await this.notificationsService.notifyUser(data.customer_id, {
      scope: NotificationScope.CUSTOMER,
      type: NotificationType.ORDER,
      priority: NotificationPriority.HIGH,
      title: 'Sản phẩm đã qua kiểm định!',
      message: `Sản phẩm của bạn khớp hoàn toàn với mô tả. Đã chốt giá thu mua: $${data.final_value.toLocaleString('en-US')}.`,
      targetUrl: '/profile/orders',
    });
  }

  @OnEvent(SUPPORT_EVENTS.CHAT_ACCEPTED)
  async handleChatAccepted(data: ChatAcceptedPayload) {
    try {
      await this.emailService.sendChatAcceptedToCustomer(data.customerEmail, {
        customerName: data.customerName,
        agentName: data.agentName,
        departmentLabel:
          CHAT_DEPARTMENT_LABELS[data.department ?? ''] || 'CSKH',
        chatUrl: this.getFrontendUrl(),
      });
    } catch (error) {
      this.logger.error(
        `[Support] Lỗi gửi mail tiếp nhận cho ${data.customerEmail}`,
        error,
      );
    }
  }

  private getFrontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'
    ).replace(/\/$/, '');
  }

  private getDepartmentMailReceiver(department: string): string {
    const fallback =
      this.configService.get<string>('MAIL_SUPPORT_RECEIVER') ||
      'support@hn-odyssey.com';
    if (department === 'SALE')
      return this.configService.get<string>('MAIL_SALES_RECEIVER') || fallback;
    if (department === 'TECH')
      return this.configService.get<string>('MAIL_TECH_RECEIVER') || fallback;
    return fallback;
  }
}
