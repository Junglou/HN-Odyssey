export interface CreatePaymentUrlDto {
  orderCode: string;
  amount: number;
  description: string;
  ipAddr: string;
}

export interface VnpayIpnData {
  vnp_SecureHash: string;
  vnp_SecureHashType?: string;
  vnp_Amount: string | number;
  vnp_ResponseCode: string;
  vnp_TxnRef: string;
  vnp_TransactionNo: string;
  [key: string]: string | number | undefined;
}

export interface ParsedWebhookData {
  transactionCode: string;
  amount: number;
  responseCode: string;
  orderCode: string;
}

// Trong payment-strategy.interface.ts
export interface PaymentStrategy {
  createPaymentUrl(config: any, dto: CreatePaymentUrlDto): Promise<string>;
  verifyWebhookData(config: any, data: Record<string, unknown>): boolean;
  parseWebhookData(data: Record<string, unknown>): ParsedWebhookData;
  getRefundDate(paymentLogData: Record<string, unknown>): string;
  refundTransaction?(
    config: any,
    orderCode: string,
    amount: number,
    transDate: string,
    userAction: string,
  ): Promise<boolean>;
}

export interface MomoIpnData {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  orderType: string;
  transId: number;
  resultCode: number;
  message: string;
  payType: string;
  responseTime: number;
  extraData: string;
  signature: string;
  [key: string]: string | number | undefined;
}

export interface MomoCreateResponse {
  partnerCode: string;
  requestId: string;
  orderId: string;
  amount: number;
  responseTime: number;
  message: string;
  resultCode: number;
  payUrl: string;
  shortLink?: string;
}
