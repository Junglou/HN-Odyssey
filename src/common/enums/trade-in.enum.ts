export enum TradeInStatus {
  PENDING_VALUATION = 'PENDING_VALUATION', // AC1: Chờ định giá
  MANUAL_REVIEW = 'MANUAL_REVIEW', // AC2: Cần thẩm định thủ công
  VALUATION_APPROVED = 'VALUATION_APPROVED', // AC4: Chấp thuận thu mua
  SHIPPING_TO_WAREHOUSE = 'SHIPPING_TO_WAREHOUSE', // AC4: Đang vận chuyển ngược
  INSPECTION = 'INSPECTION', // AC5: Đang kiểm định tại kho
  RENEGOTIATING = 'RENEGOTIATING', // AC5: Thương lượng lại giá do sai lệch
  COMPLETED = 'COMPLETED', // AC6: Hoàn tất (Đã thanh toán)
  CANCELLED = 'CANCELLED', // Khách hoặc Admin hủy
}

export enum PayoutMethod {
  VOUCHER = 'VOUCHER', // AC6: Mặc định, giá trị cao hơn
  BANK_TRANSFER = 'BANK_TRANSFER', // AC6: Chuyển khoản
}

export interface TradeInTimelineEvent {
  status: TradeInStatus;
  timestamp: Date;
  actor_id?: string;
  note?: string;
}
