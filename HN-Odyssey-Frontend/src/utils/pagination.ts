export type PageItem = number | "...";

// Rút gọn dãy số trang: 1 … 4 5 6 … 24
export function getPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const items: PageItem[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) items.push("...");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push("...");
  items.push(total);

  return items;
}
