import type {
  CustomerOrderDetail,
  CustomerOrderListItem,
  CustomerOrderListSummary,
  CustomerOrderShippingInfo,
} from "../types/order";
import type {
  OrderItem,
  OrderShippingInfo,
  OrderSummary,
  OrderTimelineEntry,
  UserOrder,
  UserOrderDetail,
} from "../types/user";

/** List API item with optional fields the backend may add later */
export type CustomerOrderListApiItem = CustomerOrderListItem & {
  updatedAt?: string | Date;
  shipping_info?: CustomerOrderShippingInfo | null;
  shipping_fee?: number | null;
  summary?:
    | (CustomerOrderListSummary & { quantity?: number; price?: number })
    | null;
};

export const mapOrderStatusLabel = (status?: string | null): string => {
  if (!status) return "";
  switch (status.toUpperCase()) {
    case "PENDING":
    case "CONFIRMED":
    case "PRIORITY":
      return "Pending";
    case "PROCESSING":
    case "ON_HOLD":
    case "TRADE_IN_REVIEW":
      return "Processing";
    case "SHIPPING":
    case "READY_TO_SHIP":
    case "DELIVERING":
      return "Delivering";
    case "DELIVERED":
    case "COMPLETED":
      return "Delivered";
    case "CANCELLED":
    case "CANCELED":
    case "DELIVERY_FAILED":
    case "RETURNED":
      return "Canceled";
    default:
      return status;
  }
};

const mapShippingInfo = (
  shipping?: CustomerOrderShippingInfo | null,
): OrderShippingInfo | null => {
  if (!shipping) return null;
  return {
    name: shipping.name ?? "",
    phone: shipping.phone ?? "",
    address: shipping.address ?? "",
    districtCode: shipping.district_code ?? "",
    wardCode: shipping.ward_code ?? "",
    cityCode: shipping.city_code ?? "",
    email: shipping.email,
    provider: shipping.provider,
    trackingCode: shipping.tracking_code,
  };
};

const mapListSummary = (
  summary?: CustomerOrderListApiItem["summary"],
): OrderSummary | null => {
  if (!summary) return null;
  return {
    image: summary.image ?? "",
    name: summary.name ?? "",
    quantity: summary.quantity ?? 1,
    price: summary.price ?? 0,
    remainingCount: summary.remaining_count ?? 0,
  };
};

const formatDate = (value?: string | Date): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
};

export const mapCustomerOrderFromApi = (
  order: CustomerOrderListApiItem,
): UserOrder => ({
  id: order._id ? String(order._id) : "",
  orderCode: order.order_code ?? "",
  createdAt: formatDate(order.createdAt),
  updatedAt: formatDate(order.updatedAt ?? order.createdAt),
  totalAmount: order.total_amount ?? 0,
  status: order.status ?? "",
  statusLabel: mapOrderStatusLabel(order.status),
  shippingInfo: mapShippingInfo(order.shipping_info ?? null),
  shippingFee: order.shipping_fee ?? null,
  summary: mapListSummary(order.summary),
});

/** Maps full detail document → list-style `UserOrder` for OrderDetail UI */
export const mapCustomerOrderDetailToUserOrder = (
  order: CustomerOrderDetail,
): UserOrder => {
  const firstItem = order.items[0];
  const remainingCount = Math.max(0, order.items.length - 1);

  return {
    id: String(order._id),
    orderCode: order.order_code,
    createdAt: formatDate(order.createdAt),
    updatedAt: formatDate(order.updatedAt),
    totalAmount: order.total_amount,
    status: order.status,
    statusLabel: mapOrderStatusLabel(order.status),
    shippingInfo: mapShippingInfo(order.shipping_info),
    shippingFee: order.actual_shipping_fee ?? null,
    summary: firstItem
      ? {
          image: firstItem.image,
          name: firstItem.product_name,
          quantity: firstItem.quantity,
          price: firstItem.price,
          remainingCount,
        }
      : null,
  };
};

export const mapCustomerOrderDetailFromApi = (
  order: CustomerOrderDetail,
): UserOrderDetail => ({
  id: String(order._id),
  orderCode: order.order_code,
  userId: order.user_id ? String(order.user_id) : undefined,
  guestInfo: order.guest_info
    ? {
        name: order.guest_info.name,
        phone: order.guest_info.phone,
        email: order.guest_info.email,
      }
    : undefined,
  isGuest: order.isGuest,
  items: order.items.map(
    (item): OrderItem => ({
      productId: String(item.product_id),
      sku: item.sku,
      productName: item.product_name,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
      variantName: item.variant_name,
    }),
  ),
  payment: {
    method: order.payment.method,
    status: order.payment.status,
    transactionId: order.payment.transaction_id,
  },
  totalAmount: order.total_amount,
  status: order.status,
  discountAmount: order.discount_amount,
  voucherCode: order.voucher_code,
  cancelReason: order.cancel_reason,
  holdExpiresAt: order.hold_expires_at
    ? formatDate(order.hold_expires_at)
    : undefined,
  sessionId: order.session_id,
  shippingInfo: mapShippingInfo(order.shipping_info) ?? {
    name: "",
    phone: "",
    address: "",
    districtCode: "",
    wardCode: "",
    cityCode: "",
  },
  waybillCode: order.waybill_code,
  actualShippingFee: order.actual_shipping_fee,
  timeline: order.timeline.map(
    (entry): OrderTimelineEntry => ({
      status: entry.status,
      timestamp: formatDate(entry.timestamp),
      actor: entry.actor,
      note: entry.note,
    }),
  ),
  internalNote: order.internal_note,
  printCount: order.print_count,
  pointsUsed: order.points_used,
  createdAt: formatDate(order.createdAt),
  updatedAt: formatDate(order.updatedAt),
});
