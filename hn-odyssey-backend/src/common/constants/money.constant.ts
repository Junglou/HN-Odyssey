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
