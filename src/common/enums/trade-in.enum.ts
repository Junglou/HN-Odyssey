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
  VOUCHER = 'Store Credit / Voucher',
  REWARD_POINTS = 'Reward Points',
  SERVICE_PROMOTION = 'Service Promotion',
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
