/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { PaymentStrategy } from 'src/common/interfaces/payment-strategy.interface';
import { PaymentConfig } from '../schemas/payment-config.schema';

/**
 * Hùng lưu ý: Hãy mở file 'src/modules/sales/payment/dto/create-payment-link.dto.ts'
 * Xem chính xác tên class được export là gì (Ví dụ: CreatePaymentDto hoặc CreatePaymentLinkDto)
 * Nếu chưa chắc chắn, bạn có thể dùng 'any' tạm thời để vượt qua lỗi compile:
 */
type CreatePaymentDtoStub = any;

@Injectable()
export class CodService implements PaymentStrategy {
  // AC1: Trả về chuỗi rỗng để thỏa mãn kiểu trả về string của Interface
  async createPaymentUrl(
    _config: PaymentConfig,
    _dto: CreatePaymentDtoStub,
  ): Promise<string> {
    return Promise.resolve('');
  }

  // AC2: Luôn trả về true vì COD không cần kiểm tra checksum từ bên thứ 3
  verifyWebhookData(
    _config: PaymentConfig,
    _rawData: Record<string, unknown>,
  ): boolean {
    return true;
  }

  // AC3: Parse dữ liệu từ request nội bộ (nếu cần dùng cho logic đồng bộ)
  parseWebhookData(rawData: Record<string, unknown>) {
    return {
      responseCode: '00',
      amount: Number(rawData['amount']) || 0,
      orderCode:
        typeof rawData['orderCode'] === 'string' ? rawData['orderCode'] : '',
      transactionCode: 'CASH_ON_DELIVERY',
    };
  }

  async refundTransaction(): Promise<boolean> {
    return Promise.resolve(true);
  }

  getRefundDate(): string {
    return new Date().toISOString();
  }
}
