import { DAY_MS, toVnParts } from './date-range.util';

/**
 * Phân bổ chi phí quảng cáo theo ngày (giờ VN) — mục 3.4 báo cáo Ad Spend Ledger.
 * Chia đều theo ngày, tính bằng cent nguyên; cent dư dồn vào NGÀY CUỐI của dòng
 * → Σ phân bổ của 1 dòng luôn đúng bằng amount, và "theo ngày" khớp "theo kỳ".
 */

/** Field tối thiểu cần để phân bổ — khớp AdSpendEntry (lean) */
export interface AllocatableSpendEntry {
  amount: number;
  period_start: Date;
  period_end: Date;
  is_voided?: boolean;
}

/** Số thứ tự ngày theo giờ VN (1970-01-01 = 0). Hai thời điểm cùng ngày VN → cùng số */
export const toVnDayIndex = (date: Date): number => {
  const p = toVnParts(date);
  return Date.UTC(p.y, p.m, p.d) / DAY_MS;
};

/** Số thứ tự ngày → "YYYY-MM-DD" (cùng định dạng $dateToString của báo cáo trend) */
export const vnDayKey = (dayIndex: number): string =>
  new Date(dayIndex * DAY_MS).toISOString().slice(0, 10);

/** soNgay(a, b): số ngày theo giờ VN, tính cả hai đầu. Kỳ ngược → 0 */
export const countVnDays = (start: Date, end: Date): number =>
  Math.max(0, toVnDayIndex(end) - toVnDayIndex(start) + 1);

export const toCents = (usd: number): number => Math.round(usd * 100);

/** Làm tròn đến cent — dùng khi cộng dồn nhiều con số USD */
export const roundMoney = (usd: number): number => Math.round(usd * 100) / 100;

interface EntrySplit {
  first: number; // dayIndex ngày đầu của dòng
  last: number; // dayIndex ngày cuối của dòng
  perDay: number; // cent mỗi ngày
  lastDayExtra: number; // cent dư cộng vào ngày cuối
}

const splitEntry = (entry: AllocatableSpendEntry): EntrySplit | null => {
  if (entry.is_voided) return null;
  const first = toVnDayIndex(entry.period_start);
  const last = toVnDayIndex(entry.period_end);
  const days = last - first + 1;
  const cents = toCents(entry.amount);
  if (days <= 0 || cents <= 0) return null;

  const perDay = Math.floor(cents / days);
  return { first, last, perDay, lastDayExtra: cents - perDay * days };
};

/** Phần giao nhau (theo dayIndex) giữa kỳ của dòng và kỳ lọc; thiếu mốc nào thì không chặn phía đó */
const overlapDays = (
  split: EntrySplit,
  rangeStart?: Date | null,
  rangeEnd?: Date | null,
): { from: number; to: number } | null => {
  const from = rangeStart
    ? Math.max(split.first, toVnDayIndex(rangeStart))
    : split.first;
  const to = rangeEnd
    ? Math.min(split.last, toVnDayIndex(rangeEnd))
    : split.last;
  return from <= to ? { from, to } : null;
};

/**
 * chiPhiTrongKy = Σ phần chi phí rơi vào [rangeStart, rangeEnd] của các dòng chưa hủy (USD).
 * Không truyền kỳ → tổng toàn thời gian.
 * rangeEnd có thể là 23:59:59.999 giờ VN (toVnDayRange) — vẫn được tính là đúng ngày đó.
 */
export const allocateSpendInRange = (
  entries: AllocatableSpendEntry[],
  rangeStart?: Date | null,
  rangeEnd?: Date | null,
): number => {
  let cents = 0;
  for (const entry of entries) {
    const split = splitEntry(entry);
    if (!split) continue;
    const win = overlapDays(split, rangeStart, rangeEnd);
    if (!win) continue;

    cents += split.perDay * (win.to - win.from + 1);
    if (win.to === split.last) cents += split.lastDayExtra;
  }
  return cents / 100;
};

/**
 * Chi phí phân bổ cho từng ngày trong kỳ (USD), key "YYYY-MM-DD", sắp xếp tăng dần.
 * Chỉ trả về ngày có chi phí > 0 — nơi gọi tự lấp ngày trống.
 */
export const allocateSpendByDay = (
  entries: AllocatableSpendEntry[],
  rangeStart?: Date | null,
  rangeEnd?: Date | null,
): Map<string, number> => {
  const centsByDay = new Map<number, number>();

  for (const entry of entries) {
    const split = splitEntry(entry);
    if (!split) continue;
    const win = overlapDays(split, rangeStart, rangeEnd);
    if (!win) continue;

    for (let day = win.from; day <= win.to; day++) {
      const add = split.perDay + (day === split.last ? split.lastDayExtra : 0);
      centsByDay.set(day, (centsByDay.get(day) ?? 0) + add);
    }
  }

  const result = new Map<string, number>();
  [...centsByDay.keys()]
    .sort((a, b) => a - b)
    .forEach((day) => {
      const cents = centsByDay.get(day) ?? 0;
      if (cents > 0) result.set(vnDayKey(day), cents / 100);
    });
  return result;
};
