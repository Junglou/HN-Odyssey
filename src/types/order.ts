/**
 * Types for customer order APIs under `/users/customers/orders`.
 * Field names follow the backend response (snake_case).
 */

/** Order status values from `Order` schema enum */
export type CustomerOrderStatus =
  | "TEMPORARY"
  | "PENDING"
  | "PRIORITY"
  | "CONFIRMED"
  | "PROCESSING"
  | "ON_HOLD"
  | "READY_TO_SHIP"
  | "SHIPPING"
  | "DELIVERED"
  | "DELIVERY_FAILED"
  | "COMPLETED"
  | "CANCELLED"
  | "RETURNED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "REFUND_NEEDED"
  | "TRADE_IN_REVIEW";

/** Filter values accepted by `GET /users/customers/orders?status=` */
export type CustomerOrderListStatusFilter =
  | "ALL"
  | "PENDING"
  | "PROCESSING"
  | "DELIVERING"
  | "COMPLETED"
  | "CANCELED";

export type CustomerOrderPaymentMethod =
  | "COD"
  | "VNPAY"
  | "MOMO"
  | "ZALOPAY"
  | string;

export type CustomerOrderPaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "REFUND_NEEDED"
  | string;

/** Line item on full order detail (`items[]`) */
export interface CustomerOrderItem {
  product_id: string;
  sku: string;
  product_name: string;
  price: number;
  quantity: number;
  image: string;
  variant_name?: string;
}

/** Guest checkout info on full order detail */
export interface CustomerOrderGuestInfo {
  name: string;
  phone: string;
  email?: string;
}

/** Payment block on full order detail */
export interface CustomerOrderPayment {
  method: CustomerOrderPaymentMethod;
  status: CustomerOrderPaymentStatus;
  transaction_id?: string;
}

/** Shipping block on full order detail */
export interface CustomerOrderShippingInfo {
  name: string;
  phone: string;
  address: string;
  district_code: string;
  ward_code: string;
  city_code: string;
  email?: string;
  provider?: string;
  tracking_code?: string;
}

/** Timeline entry on full order detail */
export interface CustomerOrderTimelineEntry {
  status: string;
  timestamp: string | Date;
  actor: string;
  note?: string;
}

/** Compact product preview on list response (`summary`) */
export interface CustomerOrderListSummary {
  image: string;
  name: string;
  remaining_count: number;
}

/**
 * Single item from `GET /users/customers/orders` → `data[]`.
 * 6 top-level fields (+ 3 inside optional `summary`).
 */
export interface CustomerOrderListItem {
  _id: string;
  order_code: string;
  createdAt: string | Date;
  total_amount: number;
  status: CustomerOrderStatus | string;
  summary: CustomerOrderListSummary | null;
}

/** Pagination block on list response */
export interface CustomerOrdersListMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/** Response body of `GET /users/customers/orders` */
export interface CustomerOrdersListResponse {
  data: CustomerOrderListItem[];
  meta: CustomerOrdersListMeta;
}

/**
 * Full order document from `GET /users/customers/orders/:orderId` → `data`.
 * 23 top-level fields from the Order schema.
 */
export interface CustomerOrderDetail {
  _id: string;
  order_code: string;
  user_id?: string;
  guest_info?: CustomerOrderGuestInfo;
  isGuest: boolean;
  items: CustomerOrderItem[];
  payment: CustomerOrderPayment;
  total_amount: number;
  status: CustomerOrderStatus | string;
  discount_amount: number;
  voucher_code: string;
  cancel_reason?: string;
  hold_expires_at?: string | Date;
  session_id?: string;
  shipping_info: CustomerOrderShippingInfo;
  waybill_code: string;
  actual_shipping_fee: number;
  timeline: CustomerOrderTimelineEntry[];
  internal_note?: string;
  print_count: number;
  points_used: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** Response body of `GET /users/customers/orders/:orderId` */
export interface CustomerOrderDetailResponse {
  success: boolean;
  data: CustomerOrderDetail;
}

/** Query params for `GET /users/customers/orders` */
export interface CustomerOrdersListQuery {
  status?: CustomerOrderListStatusFilter;
  keyword?: string;
  page?: number;
  limit?: number;
}
