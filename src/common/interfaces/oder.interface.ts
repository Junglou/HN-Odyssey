import { Document, Types } from 'mongoose';

// 1. ENUMS (Định nghĩa các trạng thái cố định)

export enum OrderStatus {
  TEMPORARY = 'TEMPORARY', // Đơn tạm (đang giữ hàng/chưa thanh toán xong)
  PENDING = 'PENDING', // Chờ xử lý (Đã tạo xong, chờ admin/staff duyệt)
  PRIORITY = 'PRIORITY', // Ưu tiên (Khách VIP hoặc đơn gấp)
  CONFIRMED = 'CONFIRMED', // Đã xác nhận (Đã có tiền hoặc xác nhận COD)
  SHIPPING = 'SHIPPING', // Đang giao hàng
  COMPLETED = 'COMPLETED', // Hoàn thành
  CANCELLED = 'CANCELLED', // Đã hủy
}

export enum PaymentMethod {
  COD = 'COD',
  VNPAY = 'VNPAY',
  MOMO = 'MOMO',
  ZALOPAY = 'ZALOPAY',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  REFUND_NEEDED = 'REFUND_NEEDED', // Cần hoàn tiền (Lỗi hệ thống)
}

export enum VoucherType {
  FIXED = 'FIXED', // Giảm số tiền cố định (VD: 50k)
  PERCENT = 'PERCENT', // Giảm theo % (VD: 10%)
}

// 2. CORE ENTITIES (Dữ liệu chính)

export interface CartItem {
  product_id: string | Types.ObjectId;
  product_name?: string;
  sku: string;
  quantity: number;
  price: number;
  image?: string;
  weight?: number; // Cần cho tính phí ship
}

// Interface dùng cho Item trong Order (Snapshot giá tại thời điểm mua)
export interface OrderItem {
  product_id: string | Types.ObjectId;
  sku: string;
  product_name: string;
  quantity: number;
  price: number; // Giá gốc
  final_price?: number; // Giá sau khi trừ khuyến mãi (nếu có logic tính từng item)
  image?: string;
  weight?: number;
}

export interface ShippingInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  city_code?: number; // Mã tỉnh (GHN/GHTK)
  district_code?: number; // Mã quận
  ward_code?: string; // Mã phường
  city?: string;
  district?: string;
  ward?: string;
  note?: string;
  provider?: string; // GHN, GHTK
  tracking_code?: string; // Mã vận đơn
}

export interface PaymentInfo {
  method: PaymentMethod | string;
  status: PaymentStatus | string;
  transaction_id?: string; // Mã giao dịch phía cổng thanh toán
  payment_url?: string;
}

// Interface định nghĩa dữ liệu Order thuần túy (Plain Object)
export interface OrderData {
  _id?: string | Types.ObjectId;
  order_code: string;

  guest_info?: {
    name: string;
    phone: string;
    email: string;
  };

  // Định danh khách hàng
  user_id?: string | Types.ObjectId;
  session_id?: string; // Dùng cho Guest Checkout
  isGuest: boolean;

  // Thông tin tài chính
  total_amount: number; // Tổng tiền phải trả
  shipping_fee: number;
  discount_amount: number;
  final_amount?: number; // Có thể dùng alias cho total_amount

  // Thông tin chi tiết
  status: OrderStatus | string;
  items: OrderItem[];
  shipping_info: ShippingInfo;
  payment: PaymentInfo;

  // Voucher
  voucher_code?: string;

  // Timestamps
  hold_expires_at?: Date; // Thời gian hết hạn giữ hàng
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

// 3. VOUCHER & PROMOTIONS

export interface Voucher {
  _id?: string | Types.ObjectId;
  code: string;
  type: VoucherType;
  value: number;
  status: 'ACTIVE' | 'INACTIVE';
  start_date: Date;
  end_date: Date;
  min_order_value?: number;
  usage_limit?: number;
  used_count: number;
  max_discount_amount?: number; // Mức giảm tối đa cho loại PERCENT
  applicable_category_ids?: string[]; // Áp dụng cho danh mục cụ thể
  applicable_product_ids?: string[]; // Áp dụng cho sản phẩm cụ thể
}

// Interface Input dành riêng cho Promotion Engine xử lý
export interface CartItemInput {
  productId: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

// 4. EXTERNAL INTEGRATION (VNPay, Momo, etc.)

// Interface trả về từ VNPay (IPN hoặc Return URL)
// Các trường này khớp với document của VNPay
export interface VnpayReturnParams {
  vnp_Amount: string | number; // VNPay trả về string, nhưng đôi khi ta ép kiểu number
  vnp_BankCode?: string;
  vnp_BankTranNo?: string;
  vnp_CardType?: string;
  vnp_OrderInfo?: string;
  vnp_PayDate?: string;
  vnp_ResponseCode: string;
  vnp_TmnCode?: string;
  vnp_TransactionNo?: string;
  vnp_TransactionStatus?: string;
  vnp_TxnRef: string;
  vnp_SecureHash: string;
  vnp_SecureHashType?: string;
  [key: string]: any; // Cho phép các trường mở rộng khác
}

// 5. HELPER INTERFACES (DTOs, Reports, Print)

export interface AggregateResult<T> {
  data: T[];
  totalCount: { count: number }[];
}

// Dùng cho Email Service để gửi hóa đơn
export interface InvoiceOrder {
  _id?: any;
  order_code: string;
  total_amount: number;
  shipping_fee: number;
  discount_amount: number;
  items: OrderItem[];
  shipping_info: ShippingInfo;
  createdAt: Date | string;
  payment: PaymentInfo;
  voucher_code?: string;
  guest_info?: {
    name: string;
    phone: string;
    email: string;
  };
}

// Dùng cho tính năng In Hóa Đơn (PDF)
export interface PrintTemplateData {
  type: 'INVOICE' | 'PACKING_SLIP';
  print_date: Date;
  is_copy: boolean;
  order_info: {
    code: string;
    created_at: Date | string;
    customer: any;
  };
  items: any[];
  financials?: any;
}

// 6. MONGOOSE DOCUMENT INTERFACES (QUAN TRỌNG NHẤT)

/**
 * Interface này kết hợp giữa dữ liệu nghiệp vụ (OrderData)
 * và các phương thức của Mongoose Document (save, _id, ...).
 * Dùng cái này trong Service để tránh lỗi 'Property does not exist'.
 */
export interface MongooseOrderDoc extends OrderData, Document {
  _id: any; // Override _id của Mongoose để dễ xử lý

  // Timeline (Thường là mảng sub-document trong schema)
  timeline: {
    status: string;
    timestamp: Date;
    actor: string;
    note: string;
  }[];

  // Các trường bổ sung quản trị
  cancel_reason?: string;
  internal_note?: string;
  print_count?: number; // Số lần đã in hóa đơn

  // Định nghĩa hàm save có hỗ trợ session (Transaction)
  save: (options?: { session?: any }) => Promise<this>;

  // Hàm chuyển đổi sang Object thường
  toObject: (options?: any) => OrderData;
}
