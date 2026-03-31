export const NOTIFY_EVENTS = {
  ORDER_CREATED: 'notification.order.created',
  STOCK_ALERT: 'notification.stock.alert',
  SECURITY_ALERT: 'notification.security.alert',
  SYSTEM_ERROR: 'notification.system.error',
  REVIEW_PUBLISHED: 'notification.review.published',
} as const; // Dùng 'as const' để TypeScript gợi ý chính xác member
