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
