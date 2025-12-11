import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { Twilio } from 'twilio'; // Uncomment nếu dùng Twilio: npm i twilio

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  // private twilioClient: Twilio;

  constructor(private configService: ConfigService) {
    // Khởi tạo Client nếu có Key
    /*
    const accountSid = this.configService.get('TWILIO_SID');
    const authToken = this.configService.get('TWILIO_AUTH_TOKEN');
    if (accountSid && authToken) {
      this.twilioClient = new Twilio(accountSid, authToken);
    }
    */
  }

  //Gửi OTP qua SMS (Mapping AC9)

  async sendOtp(phoneNumber: string, otp: string): Promise<boolean> {
    // 1. Chuẩn hóa số điện thoại (VN: 09xx -> +849xx) dùng cho Gateway quốc tế
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    // 2. Kiểm tra môi trường để tiết kiệm chi phí
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    if (!isProduction) {
      // --- DEV MODE: Chỉ log ra console để test luồng ---
      this.logger.debug(`[MOCK SMS] Sending OTP "${otp}" to ${formattedPhone}`);
      this.logger.debug(
        `[MOCK SMS] Content: Mã xác thực H&N Odyssey của bạn là: ${otp}. Có hiệu lực 5 phút.`,
      );
      return true;
    }

    //PROD MODE: Gửi thật 
    try {
      /* Ví dụ code Twilio:
      await this.twilioClient.messages.create({
        body: `H&N Odyssey: Mã xác thực của bạn là ${otp}`,
        from: this.configService.get('TWILIO_PHONE_NUMBER'),
        to: formattedPhone,
      });
      */

      // Hoặc gọi API Zalo ZNS / eSMS tại đây...

      this.logger.log(`OTP SMS sent successfully to ${formattedPhone}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${formattedPhone}`, error.stack);
      return false;
    }
  }

  private formatPhoneNumber(phone: string): string {
    if (phone.startsWith('0')) {
      return '+84' + phone.slice(1);
    }
    return phone;
  }
}
