export interface IUtmTag {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

// US.82 AC3 + quyết định mục 7 #3: NO_SPEND = kỳ lọc không có chi phí → ROI hiển thị "—"
export type ProfitStatus = 'PROFIT' | 'BREAK_EVEN' | 'LOSS' | 'NO_SPEND';

export interface ICampaignReport {
  campaign_id: string;
  campaign_name: string;
  status?: string;
  budget?: number;
  utm: IUtmTag;
  sessions: number;
  orders: number;
  conversion_rate: number;
  allocated_revenue: number; // Đã loại bỏ hoàn/hủy
  ad_spend: number; // Chi phí phân bổ TRONG KỲ lọc (USD)
  ad_spend_total: number; // Tổng chi phí toàn thời gian (cache trên AdCampaign)
  roi_percent: number | null; // (Revenue − Spend) ÷ Spend × 100; null khi Spend = 0
  net_profit: number;
  profit_status: ProfitStatus;
}

export interface ICouponReport {
  coupon_code: string;
  description?: string; // Bổ sung trường description
  usage_count: number; // Tổng số lượt nhập
  success_count: number; // Đã thanh toán và không hoàn/hủy
  conversion_rate: number;
  total_revenue: number;
  total_discount_cost: number;
  cost_revenue_ratio: number; // (Chi phí / Doanh thu) * 100
  customer_segments: {
    new_customers: number;
    returning_customers: number;
  };
}

export interface ILoyaltyHealthReport {
  overview: {
    total_members: number;
    total_earned_points: number;
    total_redeemed_points: number;
  };
  retention_rate: number;
  frequency: {
    member_avg_orders: number;
    guest_avg_orders: number;
  };
  burn_rate: number; // Redeemed / Earned
  tier_analysis: Array<{
    tier: string;
    total_revenue: number;
    aov: number; // Average Order Value
    ltv: number; // Life Time Value
  }>;
  cost_of_loyalty: number; // Cost / Revenue
}

export interface ICampaignTrend {
  date: string;
  sessions: number;
  orders: number;
  revenue: number;
  spend: number; // Chi phí phân bổ cho ngày này (US.82 AC5)
}

export interface IAdSpendActor {
  _id: string;
  name: string;
  email?: string;
}

export interface IAdSpendEntryView {
  entry_id: string;
  campaign_id: string;
  amount: number;
  period_start: string; // "YYYY-MM-DD" giờ VN
  period_end: string;
  note?: string;
  created_by: IAdSpendActor | null; // null = hệ thống (migration)
  created_at: Date;
  is_voided: boolean;
  voided_by: IAdSpendActor | null;
  voided_at: Date | null;
  void_reason: string | null;
}

export interface IAdSpendEntryList {
  campaign_id: string;
  lifetime_total: number;
  period_total: number | null; // null khi không truyền start_date/end_date
  entries: IAdSpendEntryView[];
  meta: { total: number; page: number; limit: number; total_pages: number };
}

export interface IAdSpendMutationResult {
  entry_id: string;
  lifetime_total: number;
}

// Bổ sung cho US2-AC2 (Chi tiết đơn hàng dùng mã)
export interface ICouponOrderDetail {
  order_code: string;
  customer_name: string;
  customer_email?: string;
  total_amount: number;
  discount_amount: number;
  status: string;
  created_at: Date;
}
