import { Types } from 'mongoose';

// 1. ENUMS (Định nghĩa các trạng thái cố định)

export enum OrderStatus {
  TEMPORARY = 'TEMPORARY', // Đơn tạm (đang giữ hàng)
  PENDING = 'PENDING', // Chờ xử lý
  CONFIRMED = 'CONFIRMED', // Đã xác nhận
  SHIPPING = 'SHIPPING', // Đang giao
  COMPLETED = 'COMPLETED', // Hoàn thành
  CANCELLED = 'CANCELLED', // Đã hủy
}

export enum PaymentMethod {
  COD = 'COD',
  VNPAY = 'VNPAY',
  MOMO = 'MOMO',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum VoucherType {
  FIXED = 'FIXED', // Giảm số tiền cố định (VD: 50k)
  PERCENT = 'PERCENT', // Giảm theo % (VD: 10%)
}

// 2. CORE ENTITIES (Dữ liệu chính)

export interface CartItem {
  product_id: string | Types.ObjectId;
  product_name?: string; // Có thể có hoặc không tuỳ lúc query
  sku: string;
  quantity: number;
  price: number;
  image?: string;
}

// Interface dùng cho Item trong Order
export interface OrderItem {
  product_id: string | Types.ObjectId;
  sku: string;
  product_name: string;
  quantity: number;
  price: number;
  final_price?: number;
  image?: string;
}

export interface ShippingInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  city?: string;
  district?: string;
  ward?: string;
  note?: string;
}

export interface PaymentInfo {
  method: PaymentMethod | string;
  status: PaymentStatus | string;
  transaction_id?: string;
  payment_url?: string;
}

// Interface đầy đủ của một Order Document
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
  session_id?: string;
  isGuest: boolean;

  // Thông tin tài chính
  total_amount: number;
  shipping_fee: number;
  discount_amount: number;
  final_amount: number;

  // Thông tin chi tiết
  status: OrderStatus | string;
  items: OrderItem[];
  shipping_info: ShippingInfo;
  payment: PaymentInfo;

  // Voucher
  voucher_code?: string;

  // Timestamps
  hold_expires_at?: Date;
  createdAt: string | Date;
  updatedAt: string | Date;
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
}

// Interface Input dành riêng cho Promotion Engine
export interface CartItemInput {
  productId: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

// 4. EXTERNAL INTEGRATION (VNPay, v.v.)

// Interface trả về từ VNPay (IPN hoặc Return URL)
export interface VnpayReturnParams {
  vnp_Amount: string;
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
  [key: string]: any;
}

// 5. HELPER INTERFACES

export interface AggregateResult<T> {
  data: T[];
  totalCount: { count: number }[];
}

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

// [FIX DONE]: Chỉ giữ lại 1 bản khai báo duy nhất và chuẩn nhất
export interface OrderWithTimeline {
  timeline: {
    status: string;
    timestamp: Date;
    actor: string;
    note: string;
  }[];
  // Hàm save có thể nhận options (như session)
  save: (options?: any) => Promise<any>;
}

// [FIX DONE]: Chỉ giữ lại 1 bản khai báo duy nhất và chuẩn nhất
export interface MongooseOrderDoc extends OrderData {
  _id: any;
  timeline: any[];
  // Hàm save có thể nhận options (như session)
  save: (options?: any) => Promise<MongooseOrderDoc>;
  toObject: (options?: any) => OrderData;
}

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
