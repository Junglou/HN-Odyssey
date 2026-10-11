import { TimeFilter } from 'src/common/dtos/dashboard-filter.dto';

// Việt Nam không có giờ mùa hè → offset cố định +07:00
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export interface VnDate {
  y: number;
  m: number; // 0-11
  d: number;
}

export interface ReportDateRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

/** Tách ngày/tháng/năm/thứ của một thời điểm theo giờ VN */
export const toVnParts = (date: Date): VnDate & { dow: number } => {
  const v = new Date(date.getTime() + VN_OFFSET_MS);
  return {
    y: v.getUTCFullYear(),
    m: v.getUTCMonth(),
    d: v.getUTCDate(),
    dow: v.getUTCDay(), // 0 = Chủ nhật
  };
};

/** 00:00 giờ VN của ngày (y, m, d). Date.UTC tự xử lý tràn ngày/tháng (d âm, d > 31...) */
export const vnStartOfDay = (y: number, m: number, d: number): Date =>
  new Date(Date.UTC(y, m, d) - VN_OFFSET_MS);

/** Nhận "2026-10-01" hoặc "2026-10-01T00:00:00.000Z" → chỉ lấy phần ngày người dùng đã chọn */
export const parseVnDate = (value: string): VnDate | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
};

/** [00:00 ngày bắt đầu, 23:59:59.999 ngày kết thúc] theo giờ VN */
export const toVnDayRange = (
  startDate: string,
  endDate: string,
): { start: Date; end: Date } | null => {
  const s = parseVnDate(startDate);
  const e = parseVnDate(endDate);
  if (!s || !e) return null;
  return {
    start: vnStartOfDay(s.y, s.m, s.d),
    end: new Date(vnStartOfDay(e.y, e.m, e.d + 1).getTime() - 1),
  };
};

/** "2026-10-01..." → "01/10/2026" */
export const formatVnDate = (value: string): string => {
  const p = parseVnDate(value);
  if (!p) return value;
  return `${String(p.d).padStart(2, '0')}/${String(p.m + 1).padStart(2, '0')}/${p.y}`;
};

export const formatVnDateTime = (date: Date): string =>
  date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

/**
 * Khoảng thời gian hiện tại & kỳ trước cho mọi báo cáo.
 * Tham số `now` để viết unit test với ngày cố định.
 */
export const getReportDateRange = (
  filter: { time_filter?: TimeFilter; start_date?: string; end_date?: string },
  now: Date = new Date(),
): ReportDateRange => {
  const timeFilter = filter.time_filter ?? TimeFilter.TODAY;
  const today = toVnParts(now);

  if (
    timeFilter === TimeFilter.CUSTOM &&
    filter.start_date &&
    filter.end_date
  ) {
    const range = toVnDayRange(filter.start_date, filter.end_date);
    if (range) {
      const span = range.end.getTime() - range.start.getTime();
      const prevEnd = new Date(range.start.getTime() - 1);
      return {
        ...range,
        prevEnd,
        prevStart: new Date(prevEnd.getTime() - span),
      };
    }
  }

  let start: Date;
  let prevStart: Date;

  switch (timeFilter) {
    case TimeFilter.TODAY:
      start = vnStartOfDay(today.y, today.m, today.d);
      prevStart = vnStartOfDay(today.y, today.m, today.d - 1);
      break;
    case TimeFilter.THIS_WEEK: {
      const sinceMonday = today.dow === 0 ? 6 : today.dow - 1;
      start = vnStartOfDay(today.y, today.m, today.d - sinceMonday);
      prevStart = vnStartOfDay(today.y, today.m, today.d - sinceMonday - 7);
      break;
    }
    case TimeFilter.THIS_YEAR:
      start = vnStartOfDay(today.y, 0, 1);
      prevStart = vnStartOfDay(today.y - 1, 0, 1);
      break;
    default: // THIS_MONTH (và CUSTOM thiếu ngày)
      start = vnStartOfDay(today.y, today.m, 1);
      prevStart = vnStartOfDay(today.y, today.m - 1, 1);
  }

  return { start, end: now, prevStart, prevEnd: new Date(start.getTime() - 1) };
};
