import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Twilio from 'twilio';

interface TwilioError {
  status?: number;
  code?: number | string;
  message?: string;
}

@Injectable()
export class SmsService {
  private twilioClient: Twilio.Twilio | null = null;
  private logger = new Logger(SmsService.name);
  private verifyServiceSid: string = '';

  constructor(
    private configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.verifyServiceSid =
      this.configService.get<string>('TWILIO_VERIFY_SERVICE_SID') || '';

    if (accountSid && authToken && this.verifyServiceSid) {
      this.twilioClient = Twilio(accountSid, authToken);
    } else {
      this.logger.warn(
        'Thiếu cấu hình Twilio. SmsService sẽ chạy ở chế độ MOCK.',
      );
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.trim().replace(/\s+/g, '');
    if (cleaned.startsWith('0')) return `+84${cleaned.slice(1)}`;
    if (cleaned.startsWith('84') && !cleaned.startsWith('+'))
      return `+${cleaned}`;
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  }

  /**
   * 1. GỬI MÃ OTP QUA TWILIO VERIFY
   * Twilio sẽ tự tạo mã và gửi, bạn không cần truyền 'otp' từ Backend nữa.
   */
  async sendOtp(phoneNumber: string) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    if (!this.twilioClient) {
      this.logger.warn(
        `[MOCK SMS] Yêu cầu gửi OTP Verify tới ${formattedPhone}`,
      );
      return { status: 'pending' };
    }

    const startTime = Date.now();
    try {
      const response = await this.twilioClient.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({
          to: formattedPhone,
          channel: 'sms',
        });

      this.eventEmitter.emit('integration.api.called', {
        provider: 'TWILIO_VERIFY_SEND',
        url: `api.twilio.com/v2/Services/${this.verifyServiceSid}/Verifications`,
        duration_ms: Date.now() - startTime,
        status_code: 201,
        is_error: false,
        request_data: { to: formattedPhone },
        response_data: { sid: response.sid, status: response.status },
      });

      return response;
    } catch (error: unknown) {
      this.handleTwilioError(
        error,
        formattedPhone,
        startTime,
        'TWILIO_VERIFY_SEND',
      );
    }
  }

  /**
   * 2. KIỂM TRA MÃ OTP
   */
  async verifyOtp(phoneNumber: string, code: string): Promise<boolean> {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    if (!this.twilioClient) return true;

    const startTime = Date.now();
    try {
      const response = await this.twilioClient.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks.create({
          to: formattedPhone,
          code: code,
        });
      return response.status === 'approved';
    } catch (error: unknown) {
      this.handleTwilioError(
        error,
        formattedPhone,
        startTime,
        'TWILIO_VERIFY_CHECK',
      );
      return false;
    }
  }

  /**
   * 3. GỬI TIN NHẮN CẢNH BÁO (Dùng cho Admin/Hệ thống)
   */
  async sendSystemAlert(phoneNumber: string, messageBody: string) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    // Đã chuyển sang chế độ MOCK để tránh tốn tiền Trial Twilio và lỗi 21612
    this.logger.warn(
      `[MOCK ALERT] Sẽ gửi cảnh báo hệ thống tới Admin ${formattedPhone}: ${messageBody}`,
    );
    return { status: 'mock_success' };
  }

  private handleTwilioError(
    error: unknown,
    phone: string,
    startTime: number,
    providerName: string,
  ) {
    let statusCode = 500;
    let errorMessage = String(error);

    if (error instanceof Error) {
      errorMessage = error.message;
      const twilioErr = error as unknown as TwilioError;
      if (typeof twilioErr.status === 'number') {
        statusCode = twilioErr.status;
      }
    }

    this.logger.error(
      `Lỗi [${providerName}] tới ${phone} (Status Code: ${statusCode}): ${errorMessage}`,
    );

    this.eventEmitter.emit('integration.api.called', {
      provider: providerName,
      duration_ms: Date.now() - startTime,
      status_code: statusCode,
      is_error: true,
      request_data: { to: phone },
      response_data: { message: errorMessage },
    });

    throw error;
  }
}
