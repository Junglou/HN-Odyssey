import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendOtp(email: string, otp: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: '[H&N Odyssey] Mã xác thực đăng ký',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Xin chào!</h2>
          <p>Mã xác thực (OTP) của bạn là: <b style="font-size: 24px; color: #007bff;">${otp}</b></p>
          <p>Mã này có hiệu lực trong 5 phút. Vui lòng không chia sẻ cho bất kỳ ai.</p>
          <p>Trân trọng,<br/>Đội ngũ H&N Odyssey</p>
        </div>
      `,
    });
  }

  async sendResetPasswordLink(email: string, link: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: '[H&N Odyssey] Yêu cầu đặt lại mật khẩu',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h3>Yêu cầu khôi phục mật khẩu</h3>
          <p>Bấm vào link dưới đây để đặt lại mật khẩu của bạn:</p>
          <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Đặt lại mật khẩu</a>
          <p>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
        </div>
      `,
    });
  }

  // Hàm chung gửi mail bất kỳ
  async sendRaw(to: string, subject: string, content: string) {
    await this.mailerService.sendMail({
      to,
      subject,
      html: content,
    });
  }
}
