import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../notifications/channels/email.service';

export interface TradeInCompletedPayload {
  email: string;
  fullName: string;
  requestCode: string;
  finalValue: number;
  payoutMethod: string;
  payoutDetails?: {
    voucher_code?: string;
    points_earned?: number;
  };
}

export interface TradeInRejectedPayload {
  email: string;
  fullName: string;
  requestCode: string;
  reason: string;
}

@Injectable()
export class TradeInNotificationListener {
  private readonly logger = new Logger(TradeInNotificationListener.name);

  constructor(private readonly emailService: EmailService) {}

  @OnEvent('trade_in.completed', { async: true })
  async handleTradeInCompletedEvent(payload: TradeInCompletedPayload) {
    this.logger.log(
      `Đang chuẩn bị gửi thông báo hoàn tất Trade-in cho ${payload.email}`,
    );

    const {
      payoutMethod,
      payoutDetails,
      finalValue,
      email,
      fullName,
      requestCode,
    } = payload;

    // --- LUỒNG 1: STORE CREDIT / VOUCHER ---
    if (
      payoutMethod === 'Store Credit / Voucher' &&
      payoutDetails?.voucher_code
    ) {
      const voucherCode = payoutDetails.voucher_code;
      const subject = `[H&N Odyssey] Hoàn tất Trade-in - Mã Voucher của bạn`;

      const emailContent = TradeInEmailTemplates.buildVoucherTemplate(
        fullName,
        requestCode,
        finalValue,
        voucherCode,
      );

      await this.emailService.sendRaw(email, subject, emailContent);
      this.logger.log(
        `Đã gửi Email chứa mã Voucher ${voucherCode} cho khách hàng.`,
      );
    }

    // --- LUỒNG 2: REWARD POINTS (ĐIỂM THƯỞNG) ---
    else if (payoutMethod === 'Reward Points') {
      const subject = `[H&N Odyssey] Hoàn tất Trade-in - Tài khoản được cộng điểm`;

      const emailContent = TradeInEmailTemplates.buildRewardPointsTemplate(
        fullName,
        requestCode,
        finalValue,
      );

      await this.emailService.sendRaw(email, subject, emailContent);
      this.logger.log(
        `Đã gửi Email thông báo cộng ${finalValue} điểm cho khách hàng.`,
      );
    }

    // --- LUỒNG 3: SERVICE PROMOTION (ƯU ĐÃI DỊCH VỤ) ---
    else if (
      payoutMethod === 'Service Promotion' &&
      payoutDetails?.voucher_code
    ) {
      const promoCode = payoutDetails.voucher_code;
      const subject = `[H&N Odyssey] Hoàn tất Trade-in - Ưu đãi dịch vụ của bạn`;

      const emailContent = TradeInEmailTemplates.buildServicePromoTemplate(
        fullName,
        requestCode,
        finalValue,
        promoCode,
      );

      await this.emailService.sendRaw(email, subject, emailContent);
      this.logger.log(
        `Đã gửi Email chứa mã Khuyến mãi dịch vụ ${promoCode} cho khách.`,
      );
    }
  }

  // --- LUỒNG 4: THÔNG BÁO TỪ CHỐI (REJECT) ---
  @OnEvent('trade_in.rejected', { async: true })
  async handleTradeInRejectedEvent(payload: TradeInRejectedPayload) {
    this.logger.log(
      `Đang chuẩn bị gửi thông báo TỪ CHỐI Trade-in cho ${payload.email}`,
    );

    const subject = `[H&N Odyssey] Cập nhật trạng thái yêu cầu Trade-in #${payload.requestCode}`;

    const emailContent = TradeInEmailTemplates.buildRejectTemplate(
      payload.fullName,
      payload.requestCode,
      payload.reason,
    );

    await this.emailService.sendRaw(payload.email, subject, emailContent);
    this.logger.log(
      `Đã gửi Email thông báo từ chối đơn ${payload.requestCode}.`,
    );
  }
}

/**
 * ============================================================================
 * TẦNG QUẢN LÝ GIAO DIỆN EMAIL (UI TEMPLATES)
 * ============================================================================
 */
class TradeInEmailTemplates {
  private static getHeader(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>H&N Odyssey Notification</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; padding: 40px 0;">
          <tr>
            <td align="center" style="padding: 20px 12px;">
              <table role="presentation" style="width: 100%; max-width: 580px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
                <tr>
                  <td style="background-color: #111827; padding: 32px 24px; text-align: center; border-bottom: 4px solid #10b981;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">H&N ODYSSEY</h1>
                    <p style="margin: 4px 0 0 0; color: #10b981; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;">Adventure & Trekking Gear</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 32px; color: #334155;">
    `;
  }

  private static getFooter(): string {
    return `
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                      Hệ thống cung cấp thiết bị Dã ngoại & Trekking chuyên nghiệp <strong>H&N Odyssey</strong>
                    </p>
                    <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8;">
                      Hotline: 1900 xxxx | Email hỗ trợ: support@hnodyssey.vn
                    </p>
                    <p style="margin: 16px 0 0 0; font-size: 11px; color: #cbd5e1;">
                      &copy; ${new Date().getFullYear()} H&N Odyssey. Toàn bộ quyền được bảo lưu.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  public static buildVoucherTemplate(
    fullName: string,
    requestCode: string,
    value: number,
    voucherCode: string,
  ): string {
    return `
      ${this.getHeader()}
      <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">Xin chào ${fullName},</h2>
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569; line-height: 1.6;">
        Yêu cầu Trade-in <strong style="color: #0f172a;">#${requestCode}</strong> của bạn đã được hoàn tất quá trình kiểm định chất lượng nghiêm ngặt thành công.
      </p>
      <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
        Trị giá thu đổi được chốt chính thức là: <span style="color: #2563eb; font-size: 20px; font-weight: 700;">$${value}</span>
      </p>
      
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; margin-bottom: 24px;">
        <tr>
          <td style="padding: 24px; text-align: center;">
            <p style="margin: 0 0 6px 0; color: #1e40af; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">MÃ VOUCHER CỦA BẠN</p>
            <p style="margin: 0; font-size: 26px; font-weight: 800; color: #1e3a8a; letter-spacing: 3px; font-family: 'Courier New', Courier, monospace;">${voucherCode}</p>
          </td>
        </tr>
      </table>
      
      <p style="margin: 0 0 28px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
        * Mã voucher này được sử dụng trực tiếp tại phân đoạn điền mã ưu đãi thuộc trang thanh toán cho các đơn hàng tiếp theo trên hệ thống trực tuyến.
      </p>
      
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
        <tr>
          <td align="center">
            <a href="https://hnodyssey.vn/shop" target="_blank" style="display: inline-block; background-color: #10b981; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 6px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">
              Sử Dụng Khảo Sát Đồ Mới Ngay
            </a>
          </td>
        </tr>
      </table>
      ${this.getFooter()}
    `;
  }

  public static buildRewardPointsTemplate(
    fullName: string,
    requestCode: string,
    value: number,
  ): string {
    return `
      ${this.getHeader()}
      <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">Xin chào ${fullName},</h2>
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569; line-height: 1.6;">
        Yêu cầu Trade-in <strong style="color: #0f172a;">#${requestCode}</strong> của bạn đã được hoàn tất thủ tục thẩm định giá trị.
      </p>
      
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; margin-bottom: 24px;">
        <tr>
          <td style="padding: 24px; text-align: center;">
            <p style="margin: 0 0 6px 0; color: #15803d; font-size: 14px; font-weight: 500;">Hệ thống đã tự động cộng vào tài khoản thành viên của bạn:</p>
            <p style="margin: 0; font-size: 30px; font-weight: 800; color: #16a34a;">+ ${value} ĐIỂM THƯỞNG</p>
          </td>
        </tr>
      </table>
      
      <p style="margin: 0 0 28px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
        Hạng mục điểm tích lũy có giá trị dùng để khấu trừ hóa đơn mua hàng trực tiếp hoặc đổi lấy các Quà tặng hiện vật giới hạn trong kho đặc quyền thành viên. Bạn có thể kiểm tra biến động số dư trong phần lịch sử tài khoản cá nhân.
      </p>
      
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
        <tr>
          <td align="center">
            <a href="https://hnodyssey.vn/account/points" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 6px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">
              Kiểm Tra Ví Điểm Thành Viên
            </a>
          </td>
        </tr>
      </table>
      ${this.getFooter()}
    `;
  }

  public static buildServicePromoTemplate(
    fullName: string,
    requestCode: string,
    value: number,
    promoCode: string,
  ): string {
    return `
      ${this.getHeader()}
      <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">Xin chào ${fullName},</h2>
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569; line-height: 1.6;">
        Yêu cầu Trade-in <strong style="color: #0f172a;">#${requestCode}</strong> của bạn đã được quy đổi thành giá trị Ưu đãi dịch vụ theo mong muốn.
      </p>
      <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
        Trị giá gói ưu đãi đặc biệt: <span style="color: #dc2626; font-size: 20px; font-weight: 700;">Giảm giá ${value}%</span>
      </p>
      
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff5f5; border: 1px dashed #fca5a5; border-radius: 8px; margin-bottom: 24px;">
        <tr>
          <td style="padding: 24px; text-align: center;">
            <p style="margin: 0 0 6px 0; color: #991b1b; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">MÃ DỊCH VỤ CỦA BẠN</p>
            <p style="margin: 0; font-size: 26px; font-weight: 800; color: #b91c1c; letter-spacing: 3px; font-family: 'Courier New', Courier, monospace;">${promoCode}</p>
          </td>
        </tr>
      </table>
      
      <p style="margin: 0 0 28px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
        * Khuyến nghị đặc biệt: Mã ưu đãi áp dụng duy nhất cho các hóa đơn liên quan đến hạng mục <strong>Dịch vụ Bảo dưỡng, Vệ sinh sâu hoặc Sửa chữa tối ưu hóa</strong> các trang bị cắm trại/dã ngoại chuyên sâu thuộc chuỗi trung tâm H&N Odyssey.
      </p>
      
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
        <tr>
          <td align="center">
            <a href="https://hnodyssey.vn/services/booking" target="_blank" style="display: inline-block; background-color: #dc2626; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 6px; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.2);">
              Đặt Lịch Bảo Dưỡng Ngay
            </a>
          </td>
        </tr>
      </table>
      ${this.getFooter()}
    `;
  }

  /**
   * Template hoàn chỉnh cho luồng thông báo TỪ CHỐI yêu cầu Trade-in
   */
  public static buildRejectTemplate(
    fullName: string,
    requestCode: string,
    reason: string,
  ): string {
    return `
      ${this.getHeader()}
      <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">Xin chào ${fullName},</h2>
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569; line-height: 1.6;">
        H&N Odyssey chân thành cảm ơn bạn đã quan tâm và gửi yêu cầu Trade-in <strong style="color: #0f172a;">#${requestCode}</strong>. 
        Tuy nhiên, sau khi bộ phận kỹ thuật tiến hành thẩm định chi tiết, chúng tôi rất tiếc phải thông báo hệ thống chưa thể tiếp nhận thiết bị của bạn trong đợt thu đổi này.
      </p>
      
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; margin-bottom: 24px;">
        <tr>
          <td style="padding: 16px 20px;">
            <p style="margin: 0 0 8px 0; color: #991b1b; font-size: 13px; font-weight: 700; text-transform: uppercase;">LÝ DO TỪ CHỐI TỪ KỸ THUẬT VIÊN:</p>
            <p style="margin: 0; font-size: 15px; color: #7f1d1d; line-height: 1.5; font-style: italic;">
              "${reason}"
            </p>
          </td>
        </tr>
      </table>
      
      <p style="margin: 0 0 28px 0; font-size: 14px; color: #475569; line-height: 1.6;">
        Nếu bạn đã gửi thiết bị qua bưu cục, thiết bị sẽ được đóng gói cẩn thận và hoàn trả lại theo địa chỉ ban đầu trong vòng 3-5 ngày làm việc tới mà không phát sinh thêm chi phí nào.
      </p>
      
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
        <tr>
          <td align="center">
            <a href="https://hnodyssey.vn/support/trade-in-policy" target="_blank" style="display: inline-block; background-color: #475569; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 6px; box-shadow: 0 4px 6px rgba(71, 85, 105, 0.2);">
              Xem Lại Chính Sách Thu Cũ
            </a>
          </td>
        </tr>
      </table>
      ${this.getFooter()}
    `;
  }
}
