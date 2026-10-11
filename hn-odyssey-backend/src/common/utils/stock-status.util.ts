// Ngưỡng tồn tối thiểu mặc định khi SKU chưa cấu hình min_stock
export const DEFAULT_MIN_STOCK = 10;

export type StockAlertStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OVER_STOCK';

// Giá trị dương đầu tiên, bỏ qua 0 / undefined / NaN
export const pickPositive = (...vals: unknown[]): number | null => {
  for (const v of vals) {
    const n = Number(v);
    if (n > 0) return n;
  }
  return null;
};

type Thresholds = { min_stock?: number; max_stock?: number } | null | undefined;

export const resolveThresholds = (
  variant: Thresholds,
  product: Thresholds,
) => ({
  min:
    pickPositive(variant?.min_stock, product?.min_stock) ?? DEFAULT_MIN_STOCK,
  max: pickPositive(variant?.max_stock, product?.max_stock), // null = không giới hạn
});

export const classifyStock = (
  stock: number,
  min: number,
  max: number | null,
): StockAlertStatus | null => {
  if (stock <= 0) return 'OUT_OF_STOCK';
  if (stock <= min) return 'LOW_STOCK';
  if (max !== null && stock > max) return 'OVER_STOCK';
  return null;
};
