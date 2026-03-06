import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentConfig } from '../schemas/payment-config.schema';
import {
  CreatePaymentUrlDto,
  MomoCreateResponse,
  MomoIpnData,
  ParsedWebhookData,
  PaymentStrategy,
} from 'src/common/interfaces/payment-strategy.interface';

@Injectable()
export class MomoService implements PaymentStrategy {
  private readonly logger = new Logger(MomoService.name);

  // 1. GỌI API MOMO ĐỂ LẤY URL THANH TOÁN
  async createPaymentUrl(
    config: PaymentConfig,
    dto: CreatePaymentUrlDto,
  ): Promise<string> {
    const partnerCode = config.merchant_id;
    const accessKey = config.access_key || ''; // MoMo bắt buộc có Access Key
    const secretKey = config.secret_key;
    const requestId = partnerCode + new Date().getTime();
    const orderId = dto.orderCode;
    const amount = dto.amount;
    const orderInfo = dto.description;
    const redirectUrl = config.return_url;
    // URL IPN (Server-to-server)
    const ipnUrl = config.ipn_url || '';
    //const requestType = 'captureWallet'; // Loại thanh toán QR/App mặc định
    const requestType = 'payWithATM'; // Nếu muốn thanh toán qua thẻ ATM
    const extraData = '';

    // Tạo chuỗi chữ ký đúng cấu trúc (Không được đổi thứ tự)
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    const signature = crypto
      .createHmac('sha256', secretKey) // MoMo dùng sha256 thay vì sha512 như VNPAY
      .update(rawSignature)
      .digest('hex');

    const requestBody = {
      partnerCode,
      //accessKey,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      extraData,
      requestType,
      signature,
      lang: 'vi',
    };

    try {
      const response = await fetch(config.api_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = (await response.json()) as MomoCreateResponse;

      if (responseData.resultCode === 0) {
        return responseData.payUrl;
      } else {
        this.logger.error(`MoMo Create Error: ${responseData.message}`);
        throw new Error(responseData.message);
      }
    } catch (error) {
      this.logger.error('Failed to connect to MoMo API', error);
      throw new Error('Không thể kết nối đến MoMo');
    }
  }

  // 2. VERIFY CHỮ KÝ TỪ IPN WEBHOOK
  // Chuyển tham số data thành rawData: any để thỏa mãn Base Interface
  verifyWebhookData(
    config: PaymentConfig,
    rawData: Record<string, unknown>,
  ): boolean {
    const data = rawData as unknown as MomoIpnData;
    const accessKey = config.access_key || '';
    const secretKey = config.secret_key;

    // Đảm bảo các giá trị truyền vào chuỗi signature là primitive (string/number)
    const rawSignature = [
      `accessKey=${accessKey}`,
      `amount=${data.amount}`,
      `extraData=${data.extraData}`,
      `message=${data.message}`,
      `orderId=${data.orderId}`,
      `orderInfo=${data.orderInfo}`,
      `orderType=${data.orderType}`,
      `partnerCode=${data.partnerCode}`,
      `payType=${data.payType}`,
      `requestId=${data.requestId}`,
      `responseTime=${data.responseTime}`,
      `resultCode=${data.resultCode}`,
      `transId=${data.transId}`,
    ].join('&');

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    return signature === data.signature;
  }

  // 3. PARSE DỮ LIỆU ĐỂ SERVICE CHÍNH XỬ LÝ
  // Tương tự ở trên, dùng rawData: any
  parseWebhookData(rawData: Record<string, unknown>): ParsedWebhookData {
    const data = rawData as unknown as MomoIpnData;
    return {
      transactionCode: String(data.transId),
      amount: Number(data.amount),
      responseCode: String(data.resultCode),
      orderCode: data.orderId,
    };
  }

  // 4. (Tùy chọn) API HOÀN TIỀN
  async refundTransaction(
    config: PaymentConfig,
    orderCode: string,
    amount: number,
    transDate: string,
    userAction: string,
  ): Promise<boolean> {
    const partnerCode = config.merchant_id;
    const accessKey = config.access_key || '';
    const secretKey = config.secret_key;
    const requestId = partnerCode + new Date().getTime();
    const orderId = orderCode;
    const transId = transDate; // Tra cứu log để truyền đúng transId của MoMo
    const lang = 'vi';
    const description = `Hoan tien don hang ${orderId} boi ${userAction}`;

    // Tạo chữ ký theo chuẩn MoMo Refund
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&description=${description}&orderId=${orderId}&partnerCode=${partnerCode}&requestId=${requestId}&transId=${transId}`;
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    const requestBody = {
      partnerCode,
      requestId,
      orderId,
      transId,
      amount,
      lang,
      description,
      signature,
    };

    try {
      const response = await fetch(config.api_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const responseData = (await response.json()) as {
        resultCode: number;
        message?: string;
      };

      if (responseData.resultCode === 0) {
        this.logger.log(`Hoàn tiền MoMo thành công đơn ${orderId}`);
        return true;
      } else {
        this.logger.error(`Lỗi hoàn tiền MoMo: ${responseData.message}`);
        throw new Error(responseData.message);
      }
    } catch (error) {
      this.logger.error('Lỗi kết nối API hoàn tiền MoMo', error);
      throw new Error('Lỗi hệ thống khi gọi cổng thanh toán');
    }
  }

  getRefundDate(paymentLogData: Record<string, unknown>): string {
    const responseTime = paymentLogData['responseTime'];

    // Kiểm tra nếu nó là string hoặc number thì mới cho phép ép kiểu
    if (typeof responseTime === 'string' || typeof responseTime === 'number') {
      return String(responseTime);
    }

    // Fallback: Nếu không tìm thấy hoặc sai kiểu, trả về timestamp hiện tại (AC4 - Refund Date)
    return new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);
  }
}
