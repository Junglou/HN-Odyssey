/** Matches backend `Gender` enum on `GET /users/customers/profile` */
export type UserGender = "MALE" | "FEMALE" | "OTHER";

/** Matches backend `UserStatus` enum */
export type UserStatus =
  | "ACTIVE"
  | "SUSPENDED"
  | "TERMINATED"
  | "INACTIVE"
  | "DELETED";

/** Matches backend `review_access` on customer profile */
export type UserReviewAccess = "ALLOWED" | "RESTRICTED";

/** Matches `social_auth` on user profile */
export interface UserSocialAuth {
  google_id?: string;
  facebook_id?: string;
}

/** Matches `loyalty` sub-document on customer profile */
export interface UserLoyalty {
  point: number;
  tier: string;
  total_spent: number;
}

/** Address item embedded in `GET /users/customers/profile` (`addresses[]`) */
export interface ProfileEmbeddedAddress {
  _id: string;
  name: string;
  phone: string;
  street: string;
  city_code: string;
  district_code: string;
  ward_code: string;
  is_default: boolean;
}

/** Wishlist item embedded in `GET /users/customers/profile` (`wishlist[]`) */
export interface ProfileWishlistItem {
  product: string;
  variant_id: string | null;
}

/** Matches `search_preferences` on customer profile */
export interface UserSearchPreferences {
  last_filters?: Record<string, unknown>;
  last_sort?: string;
}

/**
 * Matches `GET /users/customers/profile` response body (Customer discriminator).
 * Field names follow the API (snake_case). Sensitive fields excluded by the API
 * (`password`, OTP / pending contact fields) are not included.
 */
export interface UserProfile {
  _id: string;
  avatar: string | null;
  /** Virtual from backend — `first_Name` + `last_Name`, or email prefix */
  fullName?: string;
  username: string;
  email: string;
  phone?: string;
  first_Name: string;
  last_Name: string;
  gender: UserGender;
  dateOfBirth: string | null;
  social_auth: UserSocialAuth;
  roles: string[];
  permissions?: string[];
  is_portal_access?: boolean;
  status: UserStatus;
  is_deleted: boolean;
  token_version: number;
  login_attempts: number;
  lock_until: string | null;
  type: string;
  refresh_token: string | null;
  assigned_warehouse: string | null;
  last_login_at: string | null;
  createdAt: string;
  updatedAt: string;
  loyalty: UserLoyalty;
  addresses: ProfileEmbeddedAddress[];
  wishlist: ProfileWishlistItem[];
  internal_note: string;
  is_subscribed: boolean;
  review_access: UserReviewAccess;
  status_reason: string;
  search_preferences: UserSearchPreferences;
  followed_brands: string[];
}

export interface ProductRecommendation {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
}

/** Matches `GET /users/addresses` item (camelCase) */
export interface UserAddress {
  id: string;
  receiverName: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  cityCode: string;
  districtCode: string;
  wardCode: string;
  isDefault: boolean;
}

// --- Customer order API types (snake_case, from `./order`) ---

export type {
  CustomerOrderStatus,
  CustomerOrderListStatusFilter,
  CustomerOrderPaymentMethod,
  CustomerOrderPaymentStatus,
  CustomerOrderItem,
  CustomerOrderGuestInfo,
  CustomerOrderPayment,
  CustomerOrderShippingInfo,
  CustomerOrderTimelineEntry,
  CustomerOrderListSummary,
  CustomerOrderListItem,
  CustomerOrdersListMeta,
  CustomerOrdersListResponse,
  CustomerOrderDetail,
  CustomerOrderDetailResponse,
  CustomerOrdersListQuery,
} from "./order";

// --- Customer order UI types (camelCase, mapped from API types above) ---

/** Mapped from `CustomerOrderShippingInfo` */
export interface OrderShippingInfo {
  name: string;
  phone: string;
  address: string;
  districtCode: string;
  wardCode: string;
  cityCode: string;
  email?: string;
  provider?: string;
  trackingCode?: string;
}

/** Mapped from `CustomerOrderPayment` */
export interface OrderPayment {
  method: string;
  status: string;
  transactionId?: string;
}

/** Mapped from `CustomerOrderGuestInfo` */
export interface OrderGuestInfo {
  name: string;
  phone: string;
  email?: string;
}

/** Mapped from `CustomerOrderItem` */
export interface OrderItem {
  productId: string;
  sku: string;
  productName: string;
  price: number;
  quantity: number;
  image: string;
  variantName?: string;
}

/** Mapped from `CustomerOrderTimelineEntry` */
export interface OrderTimelineEntry {
  status: string;
  timestamp: string;
  actor: string;
  note?: string;
}

/** Mapped from `CustomerOrderListSummary` (+ optional line-item fields when API provides them) */
export interface OrderSummary {
  image: string;
  name: string;
  quantity: number;
  price: number;
  remainingCount: number;
}

/**
 * Mapped from `CustomerOrderListItem` for list/history UI.
 * Use `mapCustomerOrderFromApi()` to convert API → UI shape.
 */
export interface UserOrder {
  id: string;
  orderCode: string;
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
  status: string;
  statusLabel: string;
  shippingInfo: OrderShippingInfo | null;
  shippingFee: number | null;
  summary: OrderSummary | null;
}

/**
 * Mapped from `CustomerOrderDetail` for order detail UI.
 * Use a detail mapper when wiring `GET /users/customers/orders/:orderId`.
 */
export interface UserOrderDetail {
  id: string;
  orderCode: string;
  userId?: string;
  guestInfo?: OrderGuestInfo;
  isGuest: boolean;
  items: OrderItem[];
  payment: OrderPayment;
  totalAmount: number;
  status: string;
  discountAmount: number;
  voucherCode: string;
  cancelReason?: string;
  holdExpiresAt?: string;
  sessionId?: string;
  shippingInfo: OrderShippingInfo;
  waybillCode: string;
  actualShippingFee: number;
  timeline: OrderTimelineEntry[];
  internalNote?: string;
  printCount: number;
  pointsUsed: number;
  createdAt: string;
  updatedAt: string;
}

/** @deprecated Use OrderSummary on UserOrder — kept for legacy product list UIs */
export interface OrderProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  quantity?: number;
}

export function getOrderShippingAddress(
  order:
    | Pick<UserOrder, "shippingInfo">
    | Pick<UserOrderDetail, "shippingInfo">,
): string {
  return order.shippingInfo?.address?.trim() ?? "";
}

export function getOrderLineItems(order: UserOrder): OrderProduct[] {
  if (!order.summary) return [];
  const extra =
    order.summary.remainingCount > 0
      ? `+${order.summary.remainingCount} more item(s)`
      : "1 item only";
  return [
    {
      id: order.id || order.orderCode,
      name: order.summary.name,
      description: extra,
      price: order.summary.price,
      image: order.summary.image,
      quantity: order.summary.quantity,
    },
  ];
}

export function getOrderDetailLineItems(
  order: UserOrderDetail,
): OrderProduct[] {
  return order.items.map((item) => ({
    id: item.productId || item.sku,
    name: item.productName,
    description: item.variantName ?? "",
    price: item.price,
    image: item.image,
    quantity: item.quantity,
  }));
}
