import { Action, Resource } from 'src/common/enums/resource.enum';
import { RoleLevel } from 'src/common/enums/role-level.enum';
import {
  NotificationPriority,
  NotificationType,
} from './schemas/notification-log.schema';

/**
 * Danh sách sự kiện nghiệp vụ được phép tạo thông báo trong Portal.
 * Muốn thêm loại thông báo mới: thêm 1 mã ở đây + 1 dòng trong NOTIFICATION_POLICIES.
 */
export enum NotificationEvent {
  ORDER_NEW = 'ORDER_NEW',
  STOCK_LOW = 'STOCK_LOW',
  STOCK_OVER = 'STOCK_OVER',
  SECURITY_ALERT = 'SECURITY_ALERT',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  CHAT_HANDOFF = 'CHAT_HANDOFF',
  SUPPORT_TICKET = 'SUPPORT_TICKET',
  REVIEW_PENDING = 'REVIEW_PENDING',
  TRADE_IN_NEW = 'TRADE_IN_NEW',
  LOYALTY_FRAUD = 'LOYALTY_FRAUD',
  BUSINESS_KPI = 'BUSINESS_KPI',
  PAYMENT_GATEWAY_DOWN = 'PAYMENT_GATEWAY_DOWN',
  LOGIN_ATTACK = 'LOGIN_ATTACK',
  SMS_QUOTA = 'SMS_QUOTA',
  CHECKOUT_DROP = 'CHECKOUT_DROP',
  CART_ANOMALY = 'CART_ANOMALY',
}

export interface NotificationPolicy {
  type: NotificationType;
  /** Màn hình xử lý — người nhận phải có quyền trên resource này */
  resource: Resource;
  /** Action tối thiểu trên resource (MANAGE luôn thỏa) */
  action: Action;
  /** Cấp role tối thiểu (1 = BOARD, 2 = MANAGEMENT, 3 = STAFF). null = mọi cấp */
  minLevel: RoleLevel | null;
  /** Mức độ mặc định (nơi phát có thể nâng/hạ) */
  priority: NotificationPriority;
  /** Trang đích khi bấm vào thông báo */
  targetUrl: string;
  /** Cửa sổ gộp (giây). 0 = mỗi sự kiện là 1 thông báo riêng */
  dedupeWindowSec: number;
}

const HOUR = 3600;
const DAY = 24 * HOUR;

export const NOTIFICATION_POLICIES: Record<
  NotificationEvent,
  NotificationPolicy
> = {
  [NotificationEvent.ORDER_NEW]: {
    type: NotificationType.ORDER,
    resource: Resource.SALES_ORDERS,
    action: Action.READ,
    minLevel: null,
    priority: NotificationPriority.HIGH,
    targetUrl: '/portal/orders',
    dedupeWindowSec: 0, // Đã gộp bằng batch 500ms trong service
  },
  [NotificationEvent.STOCK_LOW]: {
    type: NotificationType.STOCK,
    resource: Resource.INVENTORY_STOCK,
    action: Action.READ,
    minLevel: null,
    priority: NotificationPriority.HIGH,
    targetUrl: '/portal/warehouse',
    dedupeWindowSec: 7 * DAY, // 1 cảnh báo mở / SKU cho tới khi được resolve
  },
  [NotificationEvent.STOCK_OVER]: {
    type: NotificationType.STOCK,
    resource: Resource.REPORT_STOCK,
    action: Action.READ,
    minLevel: RoleLevel.MANAGEMENT,
    priority: NotificationPriority.LOW,
    targetUrl: '/portal/inventory',
    dedupeWindowSec: DAY,
  },
  [NotificationEvent.SECURITY_ALERT]: {
    type: NotificationType.SECURITY,
    resource: Resource.SYSTEM_MONITORING,
    action: Action.READ,
    minLevel: null,
    priority: NotificationPriority.HIGH,
    targetUrl: '/portal/system',
    dedupeWindowSec: 15 * 60,
  },
  [NotificationEvent.ACCOUNT_LOCKED]: {
    type: NotificationType.SECURITY,
    resource: Resource.SYSTEM_USERS,
    action: Action.UPDATE,
    minLevel: null,
    priority: NotificationPriority.CRITICAL,
    targetUrl: '/portal/users',
    dedupeWindowSec: DAY,
  },
  [NotificationEvent.SYSTEM_ERROR]: {
    type: NotificationType.SYSTEM,
    resource: Resource.SYSTEM_MONITORING,
    action: Action.READ,
    minLevel: null,
    priority: NotificationPriority.HIGH,
    targetUrl: '/portal/system',
    dedupeWindowSec: 30 * 60,
  },
  [NotificationEvent.CHAT_HANDOFF]: {
    type: NotificationType.SUPPORT,
    resource: Resource.CRM_CHAT,
    action: Action.REPLY,
    minLevel: null,
    priority: NotificationPriority.HIGH,
    targetUrl: '/portal/live-chat',
    dedupeWindowSec: 10 * 60,
  },
  [NotificationEvent.SUPPORT_TICKET]: {
    type: NotificationType.SUPPORT,
    resource: Resource.CRM_CHAT,
    action: Action.REPLY,
    minLevel: null,
    priority: NotificationPriority.MEDIUM,
    targetUrl: '/portal/live-chat',
    dedupeWindowSec: 0,
  },
  [NotificationEvent.REVIEW_PENDING]: {
    type: NotificationType.REVIEW,
    resource: Resource.CRM_REVIEWS,
    action: Action.APPROVE,
    minLevel: null,
    priority: NotificationPriority.MEDIUM,
    targetUrl: '/portal/review-rating',
    dedupeWindowSec: HOUR, // Gộp các review mới trong 1 giờ thành 1 dòng "×N"
  },
  [NotificationEvent.TRADE_IN_NEW]: {
    type: NotificationType.ORDER,
    resource: Resource.SALES_TRADE_IN,
    action: Action.READ,
    minLevel: null,
    priority: NotificationPriority.MEDIUM,
    targetUrl: '/portal/trade-in',
    dedupeWindowSec: 0,
  },
  [NotificationEvent.LOYALTY_FRAUD]: {
    type: NotificationType.LOYALTY,
    resource: Resource.CRM_CUSTOMERS,
    action: Action.READ,
    minLevel: RoleLevel.MANAGEMENT,
    priority: NotificationPriority.HIGH,
    targetUrl: '/portal/customers',
    dedupeWindowSec: DAY,
  },
  [NotificationEvent.BUSINESS_KPI]: {
    type: NotificationType.SYSTEM,
    resource: Resource.REPORT_REVENUE,
    action: Action.READ,
    minLevel: RoleLevel.MANAGEMENT,
    priority: NotificationPriority.MEDIUM,
    targetUrl: '/portal/revenue-report',
    dedupeWindowSec: DAY,
  },
  // Cổng thanh toán lỗi liên tục (5 lỗi / 10 phút)
  [NotificationEvent.PAYMENT_GATEWAY_DOWN]: {
    type: NotificationType.SYSTEM,
    resource: Resource.SYSTEM_MONITORING,
    action: Action.READ,
    minLevel: null,
    priority: NotificationPriority.CRITICAL,
    targetUrl: '/portal/system',
    dedupeWindowSec: HOUR,
  },
  // Đăng nhập thất bại hàng loạt trên toàn hệ thống (> 100 lần / phút)
  [NotificationEvent.LOGIN_ATTACK]: {
    type: NotificationType.SECURITY,
    resource: Resource.SYSTEM_MONITORING,
    action: Action.READ,
    minLevel: null,
    priority: NotificationPriority.CRITICAL,
    targetUrl: '/portal/system',
    dedupeWindowSec: 30 * 60,
  },
  // Hạn mức SMS: 80% là HIGH, 90% leo thang thành CRITICAL trên CÙNG thông báo
  [NotificationEvent.SMS_QUOTA]: {
    type: NotificationType.SYSTEM,
    resource: Resource.SYSTEM_MONITORING,
    action: Action.READ,
    minLevel: null,
    priority: NotificationPriority.HIGH,
    targetUrl: '/portal/system',
    dedupeWindowSec: 31 * DAY,
  },
  // Tỷ lệ bỏ dở thanh toán tăng đột biến — xem phễu chuyển đổi ở trang BI
  [NotificationEvent.CHECKOUT_DROP]: {
    type: NotificationType.SYSTEM,
    resource: Resource.REPORT_INVENTORY, // Mã quyền của trang Business Intelligence
    action: Action.READ,
    minLevel: RoleLevel.MANAGEMENT,
    priority: NotificationPriority.HIGH,
    targetUrl: '/portal/bi',
    dedupeWindowSec: 6 * HOUR,
  },
  // 1 SKU bị bỏ giỏ bất thường — có thể do lỗi hiển thị / cấu hình giá
  [NotificationEvent.CART_ANOMALY]: {
    type: NotificationType.SYSTEM,
    resource: Resource.REPORT_INVENTORY,
    action: Action.READ,
    minLevel: RoleLevel.MANAGEMENT,
    priority: NotificationPriority.MEDIUM,
    targetUrl: '/portal/bi',
    dedupeWindowSec: DAY,
  },
};
