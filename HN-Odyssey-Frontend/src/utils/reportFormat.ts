// ⚠️ Đơn vị tiền tạm giữ USD cho khớp dữ liệu hiện tại.
// Backlog ghi VNĐ (US.84 AC6, US.87 AC8): khi seed lại dữ liệu VND chỉ cần đổi 2 hằng số này
// (ví dụ CURRENCY = "VND", LOCALE = "vi-VN").
const CURRENCY = "USD";
const LOCALE = "en-US";

export const formatMoney = (value: number): string =>
  new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

export const formatCompactMoney = (value: number): string =>
  new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);

export const formatCompactNumber = (value: number): string =>
  new Intl.NumberFormat(LOCALE, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** "2026-10-01" → "01/10/2026" */
export const toVnDate = (iso: string): string => {
  const m = ISO_DATE.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

/** "2026-10-01" → "01/10" (nhãn trục X) */
export const toShortVnDate = (iso: string): string => {
  const m = ISO_DATE.exec(iso);
  return m ? `${m[3]}/${m[2]}` : iso;
};

/** Kỳ báo cáo in trên biểu đồ và PDF (US.95 AC3) */
export const formatPeriod = (start: string, end: string): string =>
  start === end ? toVnDate(start) : `${toVnDate(start)} - ${toVnDate(end)}`;

/**
 * Dãy ngày YYYY-MM-DD liên tục từ start → end (gồm cả 2 đầu).
 * Dùng để lấp ngày không có dữ liệu bằng 0 (US.87 AC8, US.84 AC6).
 */
export const listDatesBetween = (
  start: string,
  end: string,
  max = 3700,
): string[] => {
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) return [];
  const last = end.slice(0, 10);
  if (start.slice(0, 10) > last) return [];

  const result: string[] = [];
  const cursor = new Date(`${start.slice(0, 10)}T00:00:00Z`);
  while (result.length < max) {
    const label = cursor.toISOString().slice(0, 10);
    if (label > last) break;
    result.push(label);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
};
