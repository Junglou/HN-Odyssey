import { Types } from 'mongoose';

// REVENUE & CASH FLOW (US1)
export interface IRevenueTimelineAgg {
  _id: string; // "2023-10-01" hoặc "14" (giờ)
  revenue: number;
  orders: number;
}

export interface IPaymentShareAgg {
  _id: string; // Tên phương thức (VNPAY, COD)
  revenue: number;
}

export interface ICashFlowAgg {
  paidAmount: number;
  pendingAmount: number;
}

export interface IRevenueReport {
  currentTotalRevenue: number;
  previousTotalRevenue: number;
  growthPercentage: number;
  aov: number; // Average Order Value
  timeline: { label: string; revenue: number; orders: number }[];
  paymentShares: { method: string; revenue: number; percentage: number }[];
  cashFlow: ICashFlowAgg;
}

// SHARED FUNNEL & BEHAVIOR
export interface IFunnelStep {
  stepName: string;
  userCount: number;
  dropOffRate: number;
}

export interface IBehaviorAgg {
  _id: null;
  totalSessions: number;
  bouncedSessions: number;
  viewProductSessions: number;
  addToCartSessions: number;
  beginCheckoutSessions: number;
  purchasedSessions: number;
  desktopSessions: number;
  mobileSessions: number;
  desktopPurchases: number;
  mobilePurchases: number;
}

export interface ISourceConversionAgg {
  _id: string; // Tên source (Direct, Google...)
  sessions: number;
  purchases: number;
}

//  US2: TỶ LỆ CHUYỂN ĐỔI
export interface ITimelineTrend {
  label: string;
  rate: number;
  sessions?: number;
}

export interface IConversionReport {
  overallConversionRate: number;
  isBelowKpi: boolean; // AC8: Cảnh báo
  targetKpi: number;
  funnel: IFunnelStep[]; // AC2
  bySource: ISourceConversionAgg[]; // AC3
  byDevice: { desktopCR: number; mobileCR: number }; // AC4
  trend: ITimelineTrend[]; // AC5: Xu hướng biến động
  byCustomerType: { newCustomerCR: number; returningCustomerCR: number }; // AC7
  conversionGrowth: number;
}

//  US3: TỶ LỆ THOÁT & BỎ DỞ
export interface IPageBounce {
  path: string;
  bounceRate: number;
  sessions: number;
}

export interface IBounceAndAbandonmentReport {
  bounceRate: number; // AC1
  trend: ITimelineTrend[]; // AC6
  topBouncedPages: IPageBounce[]; // AC2
  checkoutFunnel: {
    // AC4: Xác định điểm gãy chi tiết
    beginCheckout: number;
    addShipping: number;
    addPayment: number;
    purchase: number;
  };
  abandonment: {
    overallRate: number; // AC3
    byDevice: { desktopRate: number; mobileRate: number }; // AC5
    bySource: { source: string; rate: number }[]; // AC7
  };
  visitsGrowth: number;
  bounceGrowth: number;
}

//  US4: GIỎ HÀNG BỊ BỎ QUÊN
export interface IAbandonedProductAgg {
  _id: { productId: string; sku: string }; // AC7: Phân tách theo SKU
  sku: string;
  productName: string;
  abandonedCount: number;
  lostOpportunityValue: number;
  abandonmentRate: number; // AC3
}

//  US5: KHÁCH HÀNG QUAY LẠI
export interface IRetentionAgg {
  _id: string; // User ObjectId
  orderCount: number;
  totalSpent: number;
  firstOrderDate: Date;
  lastOrderDate: Date;
}

export interface IVipCustomer {
  userId: string;
  totalSpent: number;
  orderCount: number;
  lastOrderDate: Date;
}

export interface IRetentionReport {
  newCustomers: number;
  returningCustomers: number;
  retentionRate: number; // AC1
  averagePurchaseFrequencyDays: number; // AC2
  aovComparison: { newAov: number; returningAov: number }; // AC3
  vipList: IVipCustomer[]; // AC4
  churnRiskList: IVipCustomer[]; // AC6
  cohortHeatmap: Record<string, Record<string, number>>; // AC7
  retentionGrowth: number;
}

//  BỔ SUNG CHO US4
export interface IPriceCorrelation {
  date: string;
  price: number;
  abandonedCount: number;
}

export interface IAbandonedProductAgg {
  _id: { productId: string; sku: string };
  sku: string;
  productName: string;
  abandonedCount: number;
  lostOpportunityValue: number;
  abandonmentRate: number;
  priceCorrelation: IPriceCorrelation[]; // AC4: Tương quan thay đổi giá
}

//  BỔ SUNG CHO US5
export interface IVipCustomer {
  userId: string;
  totalSpent: number;
  orderCount: number;
  lastOrderDate: Date;
}

export interface ILoyaltyTierRetention {
  tier: string;
  totalCustomers: number;
  returningCustomers: number;
  retentionRate: number;
}

export interface IRetentionReport {
  newCustomers: number;
  returningCustomers: number;
  retentionRate: number;
  averagePurchaseFrequencyDays: number;
  aovComparison: { newAov: number; returningAov: number };
  vipList: IVipCustomer[];
  churnRiskList: IVipCustomer[];
  cohortHeatmap: Record<string, Record<string, number>>; // AC7
  loyaltyRetention: ILoyaltyTierRetention[]; // AC8: So sánh hạng thành viên
  retentionTrend: ITimelineTrend[]; // AC9: Xu hướng giữ chân theo thời gian
}

//  GIAO DIỆN KẾT QUẢ AGGREGATION MONGODB

export interface IRevenueTimeSeries {
  _id: string; // VD: "2026-03-19" hoặc "2026-03"
  total_revenue: number;
  total_orders: number;
}

export interface IHeatmapData {
  _id: {
    day_of_week: number; // 1 (Chủ nhật) -> 7 (Thứ 7)
    hour: number; // 0 -> 23
  };
  order_count: number;
  revenue: number;
}

export interface IGeoAnalysisData {
  _id: string; // city_code hoặc province name
  total_revenue: number;
  order_count: number;
}

export interface IBasketAnalysisResult {
  _id: {
    product_a: Types.ObjectId;
    product_b: Types.ObjectId;
  };
  frequency: number; // Số lần xuất hiện cùng nhau
}

export interface IProductTrend {
  _id: string; // SKU hoặc Product ID
  product_name: string;
  total_sold: number;
  revenue: number;
}

export interface IInventorySalesCorrelation {
  _id: Types.ObjectId;
  sku: string;
  productName: string;
  totalSold: number;
  currentStock: number;
  turnoverRate: number; // Tốc độ luân chuyển
  classification: 'HIGH_DEMAND' | 'SLOW_MOVING' | 'NORMAL';
}

export interface IYoYComparison {
  period: string; // VD: "Tháng 1", "Tháng 2"
  currentRevenue: number;
  previousRevenue: number;
  growthRate: number; // %
}

export interface IForecastData {
  period: string; // VD: "2026-05"
  actualRevenue: number | null;
  forecastedRevenue: number;
}
