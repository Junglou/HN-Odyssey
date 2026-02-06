import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as qs from 'qs';
import { VnpayReturnParams } from 'src/common/interfaces/oder.interface';

@Injectable()
export class VnpayService {
  //Tạo URL thanh toán chuyển hướng sang VNPAY
  createPaymentUrl(
    orderCode: string,
    amount: number, // Số tiền gốc (chưa nhân 100)
    orderDescription: string,
    ipAddr: string,
  ): string {
    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    const vnpUrl =
      process.env.VNP_URL ||
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const returnUrl = process.env.VNP_RETURN_URL;

    if (!tmnCode || !secretKey || !returnUrl) {
      throw new BadRequestException(
        'Cấu hình VNPAY phía Server chưa đầy đủ (Thiếu ENV).',
      );
    }

    // Format ngày YYYYMMDDHHmmss
    const date = new Date();
    const createDate =
      date.getFullYear().toString() +
      ('0' + (date.getMonth() + 1)).slice(-2) +
      ('0' + date.getDate()).slice(-2) +
      ('0' + date.getHours()).slice(-2) +
      ('0' + date.getMinutes()).slice(-2) +
      ('0' + date.getSeconds()).slice(-2);

    // VNPAY yêu cầu số tiền * 100
    const vnpAmount = Math.floor(amount * 100);

    // Sử dụng Record thay vì any để định nghĩa kiểu dữ liệu rõ ràng
    const vnp_Params: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderCode,
      vnp_OrderInfo: orderDescription,
      vnp_OrderType: 'other',
      vnp_Amount: vnpAmount,
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    // Hàm sortObject giờ trả về kiểu rõ ràng, không còn lỗi Unsafe assignment
    const sortedParams = this.sortObject(vnp_Params);

    // Ký tên (Hashing)
    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Thêm mã hash vào params cuối cùng
    sortedParams['vnp_SecureHash'] = signed;

    return vnpUrl + '?' + qs.stringify(sortedParams, { encode: false });
  }

  //Kiểm tra tính toàn vẹn dữ liệu từ IPN/Return URL
  verifyReturnUrl(vnpParams: VnpayReturnParams): boolean {
    const secureHash = vnpParams.vnp_SecureHash;
    const secretKey = process.env.VNP_HASH_SECRET || '';

    // Ép kiểu về Record để có thể delete property an toàn
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

  /**
   * Helper: Sắp xếp object theo key (Yêu cầu của VNPAY để hash đúng)
   * Viết lại hoàn toàn để Type-Safe và tối ưu hơn
   */
  private sortObject(
    obj: Record<string, string | number>,
  ): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();

    keys.forEach((key) => {
      const value = String(obj[key]);
      // [FIX]: VNPay yêu cầu hash cả chuỗi rỗng nếu key đó tham gia vào cấu trúc dữ liệu?
      // Thường thì KHÔNG. Code hiện tại của bạn bỏ qua value rỗng là ĐÚNG.
      if (value && value !== '' && value !== 'undefined' && value !== 'null') {
        sorted[key] = encodeURIComponent(value).replace(/%20/g, '+');
      }
    });
    return sorted;
  }
}
