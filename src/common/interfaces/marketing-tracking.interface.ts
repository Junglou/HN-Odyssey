export interface IUtmTag {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

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
  ad_spend: number;
  roi_percent: number; // (Revenue - Spend) / Spend * 100
  net_profit: number;
  profit_status: 'PROFIT' | 'BREAK_EVEN' | 'LOSS';
}

export interface ICouponReport {
  coupon_code: string;
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

// Bổ sung cho US1-AC8 và US4-AC5 (Biểu đồ xu hướng)
export interface ICampaignTrend {
  date: string;
  sessions: number;
  orders: number;
  revenue: number;
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
