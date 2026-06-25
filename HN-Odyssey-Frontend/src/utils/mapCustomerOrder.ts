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

// Khai báo interface rõ ràng để thay thế cho any[]
export interface ApiSummaryItem {
  image?: string;
  product_name?: string;
  name?: string;
  quantity?: number;
  price?: number;
}

export type CustomerOrderListApiItem = CustomerOrderListItem & {
  updatedAt?: string | Date;
  shipping_info?: CustomerOrderShippingInfo | null;
  shipping_fee?: number | null;
  actual_shipping_fee?: number | null;
  items?: ApiSummaryItem[]; // Đã loại bỏ any
  summary?:
    | (CustomerOrderListSummary & { quantity?: number; price?: number })
    | null;
};

export const mapOrderStatusLabel = (status?: string | null): string => {
  if (!status) return "";
  switch (status.toUpperCase()) {
    case "PENDING":
    case "PRIORITY":
      return "Pending";
    case "CONFIRMED":
      return "Confirmed";
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
  return date.toISOString();
};

// Đổi từ tham số 'order: any' thành truyền trực tiếp giá trị số để thỏa mãn ESLint
const getCorrectShippingFee = (
  shippingFee?: number | null,
  actualShippingFee?: number | null,
): number | null => {
  if (shippingFee != null && shippingFee > 0) return shippingFee;

  if (actualShippingFee != null && actualShippingFee > 0) {
    return actualShippingFee > 1000
      ? actualShippingFee / 25400
      : actualShippingFee;
  }
  return null;
};

export const mapCustomerOrderFromApi = (
  order: CustomerOrderListApiItem,
): UserOrder => {
  const firstItem =
    order.items && order.items.length > 0 ? order.items[0] : null;

  let finalSummary = mapListSummary(order.summary);
  if (!finalSummary || finalSummary.price === 0) {
    if (firstItem) {
      finalSummary = {
        image: firstItem.image ?? "",
        name: firstItem.product_name ?? firstItem.name ?? "",
        quantity: firstItem.quantity ?? 1,
        price: firstItem.price ?? 0,
        remainingCount: Math.max(0, (order.items?.length || 1) - 1),
      };
    }
  }

  return {
    id: order._id ? String(order._id) : "",
    orderCode: order.order_code ?? "",
    createdAt: formatDate(order.createdAt),
    updatedAt: formatDate(order.updatedAt ?? order.createdAt),
    totalAmount: order.total_amount ?? 0,
    status: order.status ?? "",
    statusLabel: mapOrderStatusLabel(order.status),
    shippingInfo: mapShippingInfo(order.shipping_info ?? null),
    shippingFee:
      getCorrectShippingFee(order.shipping_fee, order.actual_shipping_fee) ?? 0,
    summary: finalSummary,
  };
};

export const mapCustomerOrderDetailToUserOrder = (
  order: CustomerOrderDetail,
): UserOrder => {
  const firstItem = order.items?.[0];
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
    shippingFee: getCorrectShippingFee(undefined, order.actual_shipping_fee),
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
  actualShippingFee:
    getCorrectShippingFee(undefined, order.actual_shipping_fee) ?? 0,
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
