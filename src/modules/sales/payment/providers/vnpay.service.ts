import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as qs from 'qs';
import { VnpayReturnParams } from 'src/common/interfaces/order.interface';
import {
  CreatePaymentUrlDto,
  ParsedWebhookData,
  VnpayIpnData,
} from 'src/common/interfaces/payment-strategy.interface';
import { PaymentConfig } from '../schemas/payment-config.schema';

@Injectable()
export class VnpayService {
  // Khai báo logger ở đây để giải quyết lỗi "Property 'logger' does not exist"
  private readonly logger = new Logger(VnpayService.name);

  // Tạo URL thanh toán chuyển hướng sang VNPAY
  async createPaymentUrl(
    config: PaymentConfig,
    dto: CreatePaymentUrlDto,
  ): Promise<string> {
    const date = new Date();
    const offsetGMT7 = 7 * 60 * 60 * 1000;
    const vnTime = new Date(date.getTime() + offsetGMT7);

    const yyyy = vnTime.getUTCFullYear();
    const mm = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(vnTime.getUTCDate()).padStart(2, '0');
    const hh = String(vnTime.getUTCHours()).padStart(2, '0');
    const min = String(vnTime.getUTCMinutes()).padStart(2, '0');
    const ss = String(vnTime.getUTCSeconds()).padStart(2, '0');

    const createDate = `${yyyy}${mm}${dd}${hh}${min}${ss}`;

    const vnpParams: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: config.merchant_id,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: dto.orderCode,
      vnp_OrderInfo: dto.description,
      vnp_OrderType: 'other',
      vnp_Amount: Math.floor(dto.amount * 100),
      vnp_ReturnUrl: config.return_url,
      vnp_IpAddr: dto.ipAddr,
      vnp_CreateDate: createDate,
    };

    const sortedParams = this.sortObject(vnpParams);
    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', config.secret_key);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const finalParams = sortedParams as Record<string, string | number>;
    finalParams['vnp_SecureHash'] = signed;

    return (
      config.api_endpoint + '?' + qs.stringify(finalParams, { encode: false })
    );
  }

  // Thay 'any' bằng VnpayIpnData
  verifyWebhookData(
    config: PaymentConfig,
    rawData: Record<string, unknown>,
  ): boolean {
    const data = rawData as unknown as VnpayIpnData;
    const secureHash = data.vnp_SecureHash;

    const vnpParams: Record<string, string | number | undefined> = { ...data };
    delete vnpParams.vnp_SecureHash;
    delete vnpParams.vnp_SecureHashType;

    const sortedParams = this.sortObject(vnpParams);
    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', config.secret_key);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return secureHash === signed;
  }

  parseWebhookData(rawData: Record<string, unknown>): ParsedWebhookData {
    const data = rawData as unknown as VnpayIpnData;
    return {
      transactionCode: data.vnp_TransactionNo,
      amount: Number(data.vnp_Amount) / 100,
      responseCode: data.vnp_ResponseCode,
      orderCode: data.vnp_TxnRef,
    };
  }

  // Kiểm tra tính toàn vẹn dữ liệu từ IPN/Return URL
  verifyReturnUrl(
    config: PaymentConfig,
    vnpParams: VnpayReturnParams,
  ): boolean {
    const secureHash = vnpParams.vnp_SecureHash;
    const secretKey = config.secret_key;

    const vnpParamsObj = { ...vnpParams } as unknown as Record<
      string,
      string | number
    >;
    delete vnpParamsObj['vnp_SecureHash'];
    delete vnpParamsObj['vnp_SecureHashType'];

    const sortedParams = this.sortObject(vnpParamsObj);
    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return secureHash === signed;
  }

  private sortObject(
    obj: Record<string, string | number | undefined>,
  ): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();
    keys.forEach((key) => {
      const value = obj[key];
      if (value !== null && value !== '' && value !== undefined) {
        sorted[key] = encodeURIComponent(String(value)).replace(/%20/g, '+');
      }
    });
    return sorted;
  }

  async refundTransaction(
    config: PaymentConfig,
    orderCode: string,
    amount: number,
    transDate: string,
    userAction: string,
  ): Promise<boolean> {
    const vnp_RequestId = crypto.randomUUID();
    const vnp_Version = '2.1.0';
    const vnp_Command = 'refund';
    const vnp_TmnCode = config.merchant_id;
    const vnp_TransactionType = '02'; // 02: Hoàn toàn phần
    const vnp_TxnRef = orderCode;
    const vnp_Amount = amount * 100;
    const vnp_OrderInfo = `Hoan tien don hang ${orderCode}`;
    const vnp_TransactionNo = ''; // Để trống nếu dùng vnp_TransactionDate

    // Ngày giờ giao dịch gốc (YYYYMMDDHHmmss)
    const vnp_TransactionDate =
      transDate ||
      new Date()
        .toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, 14);
    const vnp_CreateBy = userAction;
    const vnp_CreateDate = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);
    const vnp_IpAddr = '127.0.0.1'; // IP máy chủ gọi request

    // Chuỗi ký tự chuẩn VNPAY (Không mã hóa URL trước khi băm đối với API Refund)
    const data = `${vnp_RequestId}|${vnp_Version}|${vnp_Command}|${vnp_TmnCode}|${vnp_TransactionType}|${vnp_TxnRef}|${vnp_Amount}|${vnp_TransactionNo}|${vnp_TransactionDate}|${vnp_CreateBy}|${vnp_CreateDate}|${vnp_IpAddr}|${vnp_OrderInfo}`;

    const hmac = crypto.createHmac('sha512', config.secret_key);
    const vnp_SecureHash = hmac
      .update(Buffer.from(data, 'utf-8'))
      .digest('hex');

    const requestBody = {
      vnp_RequestId,
      vnp_Version,
      vnp_Command,
      vnp_TmnCode,
      vnp_TransactionType,
      vnp_TxnRef,
      vnp_Amount,
      vnp_TransactionNo,
      vnp_TransactionDate,
      vnp_CreateBy,
      vnp_CreateDate,
      vnp_IpAddr,
      vnp_OrderInfo,
      vnp_SecureHash,
    };

    try {
      // VNPAY thường dùng 1 endpoint riêng cho API Refund, bạn nên đưa cấu hình endpoint này vào DB hoặc biến môi trường
      // Mặc định Sandbox Refund Endpoint: https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
      const refundEndpoint =
        config.api_endpoint.replace('vpcpay.html', '') +
        'merchant_webapi/api/transaction';

      const response = await fetch(refundEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const responseData = (await response.json()) as {
        vnp_ResponseCode: string;
        vnp_Message: string;
      };

      // 00 là mã thành công của VNPAY API
      if (responseData.vnp_ResponseCode === '00') {
        this.logger.log(`Hoàn tiền VNPAY thành công đơn ${orderCode}`);
        return true;
      } else {
        this.logger.error(
          `Lỗi hoàn tiền VNPAY: Mã lỗi ${responseData.vnp_ResponseCode} - ${responseData.vnp_Message}`,
        );
        throw new Error(responseData.vnp_Message);
      }
    } catch (error) {
      this.logger.error('Lỗi kết nối API hoàn tiền VNPAY', error);
      throw new Error('Lỗi hệ thống khi gọi cổng thanh toán');
    }
  }

  getRefundDate(paymentLogData: Record<string, unknown>): string {
    // VNPAY trả về ngày trong trường vnp_PayDate
    const payDate = paymentLogData['vnp_PayDate'];
    return typeof payDate === 'string' ? payDate : '';
  }
}
