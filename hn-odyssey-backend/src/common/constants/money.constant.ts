// Quy tắc đã chốt: UI và total_amount dùng USD.
// Chỉ quy sang VNĐ khi làm việc với đối tác Việt Nam (VNPAY, MoMo, GHN, ngưỡng COD).
export const VND_PER_USD = 25_400;

// Ngưỡng COD của đơn vị vận chuyển (VNĐ)
export const COD_LIMIT_VND = 5_000_000;

// Tích điểm: 1 USD = 1 điểm (LoyaltyService.CONVERSION_RATE)
// Tiêu điểm: 100 điểm = 1 USD — cùng tỷ lệ với đổi voucher trong redeemPoints
export const POINT_VALUE_USD = 0.01;

export const vndToUsd = (vnd: number): number => vnd / VND_PER_USD;
export const usdToVnd = (usd: number): number => Math.round(usd * VND_PER_USD);

/** Làm tròn đến cent để tránh sai số dấu phẩy động */
export const pointsToUsd = (points: number): number =>
  Math.round(points * POINT_VALUE_USD * 100) / 100;

export const formatUsd = (usd: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(usd);

export const formatVnd = (vnd: number): string =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(vnd);

const roundCents = (value: number): number => Math.round(value * 100) / 100;

interface InvoiceTotalsSource {
  items?: { price: number; quantity: number }[];
  shipping_fee?: number;
  total_amount: number;
}

export interface InvoiceTotals {
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
}

/**
 * Tổng tiền cho hóa đơn (USD). Giảm giá = phần chênh lệch thực tế
 * (voucher + combo + điểm) để các dòng luôn cộng khớp với total_amount.
 */
export const buildInvoiceTotals = (
  order: InvoiceTotalsSource,
): InvoiceTotals => {
  const subtotal = roundCents(
    (order.items ?? []).reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
      0,
    ),
  );
  const shippingFee = roundCents(order.shipping_fee || 0);
  const total = roundCents(order.total_amount || 0);
  const discount = Math.max(0, roundCents(subtotal + shippingFee - total));

  return { subtotal, shippingFee, discount, total };
};
