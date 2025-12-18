import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';

@Injectable()
export class SmsService {
  private twilioClient: Twilio.Twilio;
  private logger = new Logger(SmsService.name);

  constructor(private configService: ConfigService) {
    const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get('TWILIO_AUTH_TOKEN');

    if (accountSid && authToken) {
      this.twilioClient = Twilio(accountSid, authToken);
    }
  }

  async sendOtp(phoneNumber: string, otp: string) {
    // Format số điện thoại VN (09xxx -> +849xxx)
    const formattedPhone = phoneNumber.startsWith('0')
      ? '+84' + phoneNumber.slice(1)
      : phoneNumber;

    if (!this.twilioClient) {
      this.logger.warn(`[MOCK SMS] Gửi tới ${formattedPhone}: OTP ${otp}`);
      return;
    }

    try {
      await this.twilioClient.messages.create({
        body: `[H&N Odyssey] Ma xac thuc cua ban la: ${otp}.`,
        from: this.configService.get('TWILIO_PHONE_NUMBER'),
        to: formattedPhone,
      });
    } catch (error) {
      this.logger.error('Lỗi gửi SMS:', error);
    }
  }
}
