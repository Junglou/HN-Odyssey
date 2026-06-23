export interface AbandonmentRateMetric {
  total_carts: number;
  abandoned_carts: number;
  abandonment_rate: number; // Tính theo % (US2-AC7)
}

export interface DropOffAnalysisResult {
  exit_page: string;
  drop_off_count: number;
  percentage: number;
}

export interface TimeToPurchaseResult {
  session_id: string;
  time_taken_minutes: number;
  classification: 'FAST_BUYER' | 'SLOW_BUYER'; // US3-AC5: Mua nhanh vs Mua chậm
}

export interface SegmentedFunnelResult {
  step: string;
  new_users_count: number;
  returning_users_count: number;
}
