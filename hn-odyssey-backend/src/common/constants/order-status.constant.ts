// Định nghĩa DUY NHẤT: đơn ở các trạng thái này KHÔNG tính vào doanh thu.
// ⚠️ Cần PO xác nhận danh sách trước khi release (xem Phần D).
export const NON_REVENUE_ORDER_STATUSES: string[] = [
  'CANCELLED',
  'DELIVERY_FAILED',
  'RETURNED',
  'REFUNDED',
  'REFUND_PENDING',
  'REFUND_NEEDED',
];
