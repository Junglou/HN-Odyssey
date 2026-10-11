import { toVnDayRange, vnStartOfDay } from './date-range.util';
import {
  allocateSpendByDay,
  allocateSpendInRange,
  countVnDays,
  toVnDayIndex,
  vnDayKey,
  type AllocatableSpendEntry,
} from './ad-spend-allocation.util';
import { describe, expect, it } from '@jest/globals';

// 00:00 giờ VN của ngày d tháng m năm 2026 (m: 1–12)
const vn = (m: number, d: number): Date => vnStartOfDay(2026, m - 1, d);

// Kỳ lọc giống báo cáo: [00:00 ngày đầu, 23:59:59.999 ngày cuối] giờ VN
const range = (from: string, to: string) => {
  const r = toVnDayRange(from, to);
  if (!r) throw new Error('Kỳ lọc không hợp lệ');
  return r;
};

const entry = (
  amount: number,
  start: Date,
  end: Date,
  is_voided = false,
): AllocatableSpendEntry => ({
  amount,
  period_start: start,
  period_end: end,
  is_voided,
});

describe('ad-spend-allocation.util', () => {
  const october = entry(3100, vn(10, 1), vn(10, 31));

  describe('Ví dụ mục 3.4 báo cáo', () => {
    it('$3.100 (01/10→31/10), lọc 01/10→10/10 → $1.000', () => {
      const r = range('2026-10-01', '2026-10-10');
      expect(allocateSpendInRange([october], r.start, r.end)).toBe(1000);
    });

    it('$3.100 (01/10→31/10), lọc 25/10→05/11 → $700', () => {
      const r = range('2026-10-25', '2026-11-05');
      expect(allocateSpendInRange([october], r.start, r.end)).toBe(700);
    });

    it('$500 (15/10), lọc 01/10→10/10 → $0', () => {
      const r = range('2026-10-01', '2026-10-10');
      const single = entry(500, vn(10, 15), vn(10, 15));
      expect(allocateSpendInRange([single], r.start, r.end)).toBe(0);
    });
  });

  describe('Quy tắc chung', () => {
    it('bỏ qua dòng đã hủy', () => {
      const voided = entry(999, vn(10, 1), vn(10, 31), true);
      const r = range('2026-10-01', '2026-10-10');
      expect(allocateSpendInRange([october, voided], r.start, r.end)).toBe(
        1000,
      );
    });

    it('không truyền kỳ lọc → tổng toàn thời gian', () => {
      const single = entry(500, vn(10, 15), vn(10, 15));
      expect(allocateSpendInRange([october, single])).toBe(3600);
    });

    it('cent dư dồn vào ngày cuối: $100 chia 3 ngày', () => {
      const e = [entry(100, vn(10, 1), vn(10, 3))];

      expect([...allocateSpendByDay(e).entries()]).toEqual([
        ['2026-10-01', 33.33],
        ['2026-10-02', 33.33],
        ['2026-10-03', 33.34],
      ]);

      const firstTwoDays = range('2026-10-01', '2026-10-02');
      expect(
        allocateSpendInRange(e, firstTwoDays.start, firstTwoDays.end),
      ).toBe(66.66);
      expect(allocateSpendInRange(e)).toBe(100);
    });

    it('Σ theo ngày = tổng trong kỳ (tiêu chí 6)', () => {
      const entries = [
        october,
        entry(100, vn(10, 1), vn(10, 3)),
        entry(250.55, vn(10, 20), vn(11, 4)),
      ];
      const r = range('2026-10-02', '2026-10-25');

      const sumByDay = [
        ...allocateSpendByDay(entries, r.start, r.end).values(),
      ].reduce((s, v) => s + v, 0);

      expect(Math.round(sumByDay * 100)).toBe(
        Math.round(allocateSpendInRange(entries, r.start, r.end) * 100),
      );
    });

    it('00:00 giờ VN vẫn là đúng ngày VN dù UTC là ngày hôm trước', () => {
      expect(vn(10, 1).toISOString()).toBe('2026-09-30T17:00:00.000Z');
      expect(vnDayKey(toVnDayIndex(vn(10, 1)))).toBe('2026-10-01');
    });

    it('countVnDays tính cả hai đầu', () => {
      expect(countVnDays(vn(10, 1), vn(10, 31))).toBe(31);
      expect(countVnDays(vn(10, 15), vn(10, 15))).toBe(1);
      expect(countVnDays(vn(10, 2), vn(10, 1))).toBe(0);
    });
  });
});
