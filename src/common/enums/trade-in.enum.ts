export enum TradeInStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  SHIPPING = 'Shipping',
  RECEIVED = 'Received',
  COMPLETED = 'Completed',
  REJECTED = 'Rejected',
  CANCELLED = 'Cancelled',
}

export enum PayoutMethod {
  PERCENTAGE_VOUCHER = 'Percentage Voucher',
  REWARD_POINTS = 'Reward Points',
  FIXED_AMOUNT = 'Fixed Amount',
}

export enum EvaluationMethod {
  VISIT_STORE = 'VISIT_STORE',
  SHIPPING = 'SHIPPING',
}

export interface TradeInTimelineEvent {
  status: TradeInStatus;
  timestamp: Date;
  actor_id?: string;
  note?: string;
}
