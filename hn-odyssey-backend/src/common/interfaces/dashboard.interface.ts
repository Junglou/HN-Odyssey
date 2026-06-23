import { Types } from 'mongoose';

export interface StockAlertItem {
  product_id: string;
  sku: string;
  name: string;
  thumbnail: string;
  current_stock: number;
  min_stock: number;
  max_stock: number;
  status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OVER_STOCK';
  priority: number;
}

export interface RawAggregatedProduct {
  _id: Types.ObjectId | string;
  sku: string;
  name: string;
  thumbnail?: string;
  stock: number;
  min_stock: number;
  max_stock: number;
  has_variants: boolean;
  variants: Array<{
    sku: string;
    stock: number;
    min_stock?: number;
    max_stock?: number;
  }>;
}

export interface ChartDataPoint {
  label: string;
  revenue: number;
  orders: number;
}

export interface PipelineStat {
  _id: string;
  count: number;
}

export interface ReturnOrderStat {
  claim_code: string;
  status: string;
}

export interface RecentTicketStat {
  id: string;
  status: string;
}

export interface SystemStageStat {
  id: string;
  type: string;
  title: string;
  desc: string;
  status: 'active' | 'offline';
}

export interface OverviewMetrics {
  net_revenue: number;
  total_orders: number;
  total_items: number;
  prev_net_revenue: number;
  prev_total_orders: number;
  revenue_growth_percent: number;
  orders_growth_percent: number;
  items_growth_percent: number;
  chart_data: ChartDataPoint[];
  pipeline_stats: PipelineStat[];
  return_stats: ReturnOrderStat[];
  recent_tickets: RecentTicketStat[];
  open_tickets_count: number;
  system_activities: SystemStageStat[];
  inventory_batches: string[];
}

export interface VariantContribution {
  sku: string;
  variant_name: string;
  quantity: number;
  revenue: number;
  contribution_percent: number;
}

export interface TopProduct {
  product_id: string;
  name: string;
  image: string;
  total_quantity: number;
  total_revenue: number;
  growth_percent: number;
  variants: VariantContribution[];
}

export interface TopCategory {
  category_id: string;
  name: string;
  total_revenue: number;
  total_quantity: number;
  revenue_contribution_percent: number;
  return_rate_percent: number;
  growth_percent: number;
}
