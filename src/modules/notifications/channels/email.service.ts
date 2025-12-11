import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  //Mapping AC9: Gửi email xác thực tài khoản

  async sendVerificationEmail(email: string, token: string) {
    // Lấy URL Frontend từ biến môi trường để tạo link
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const url = `${frontendUrl}/verify-account?token=${token}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Kích hoạt tài khoản của bạn',
        template: './verification',
        context: {
          url: url,
          otp: token,
          appName: 'H&N Odyssey',
        },
      });
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}`,
        error.stack,
      );
    }
  }

  //Mapping Feature Backlog 3: Gửi email quên mật khẩu

  async sendForgotPasswordEmail(email: string, token: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const url = `${frontendUrl}/reset-password?token=${token}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Yêu cầu đặt lại mật khẩu',
        template: './forgot-password',
        context: {
          url: url,
          appName: 'H&N Odyssey',
        },
      });
      this.logger.log(`Reset password email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send reset password email to ${email}`,
        error.stack,
      );
    }
  }

  //Mapping AC14: Gửi email chào mừng sau khi đăng ký thành công (Optional)

  async sendWelcomeEmail(email: string, fullName: string) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Chào mừng đến với H&N Odyssey',
        template: './welcome',
        context: {
          name: fullName,
          appName: 'H&N Odyssey',
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${email}`,
        error.stack,
      );
    }
  }
}
