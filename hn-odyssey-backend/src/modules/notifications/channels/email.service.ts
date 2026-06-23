import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

// 1. Định nghĩa Interface
interface InvoiceItem {
  product_name: string;
  sku: string;
  quantity: number;
  price: number;
}

interface InvoiceOrder {
  order_code: string;
  items: InvoiceItem[];
  total_amount: number;
  discount_amount?: number;
  createdAt?: Date | string;
  shipping_info?: {
    name?: string;
    phone?: string;
    address?: string;
  };
}

interface Attachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

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

  // THÊM MỚI: Gửi hóa đơn bán hàng
  async sendInvoice(email: string, order: InvoiceOrder, pdfBuffer?: Buffer) {
    const htmlContent = this.generateInvoiceHtml(order); // Gọi hàm helper

    const attachments: Attachment[] = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `Invoice-${order.order_code}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
    }

    await this.mailerService.sendMail({
      to: email,
      subject: `[H&N Odyssey] Xác nhận đơn hàng #${order.order_code}`,
      html: htmlContent,
      attachments: attachments,
    });
  }

  // HELPER METHODS

  private generateInvoiceHtml(order: InvoiceOrder): string {
    // 1. Render rows
    const itemsHtml = order.items
      .map(
        (item) => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px;">
            <strong>${item.product_name}</strong><br/>
            <small style="color: #666;">SKU: ${item.sku}</small>
          </td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">${this.formatCurrency(item.price)}</td>
          <td style="text-align: right; font-weight: bold;">
            ${this.formatCurrency(item.price * item.quantity)}
          </td>
        </tr>
    `,
      )
      .join('');

    // 2. Main Template
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0;">
        <div style="background-color: #000; color: #fff; padding: 20px; text-align: center;">
           <h2>H&N ODYSSEY</h2>
           <p>Cảm ơn bạn đã mua sắm!</p>
        </div>
        
        <div style="padding: 20px;">
           <p>Xin chào <strong>${order.shipping_info?.name || 'Khách hàng'}</strong>,</p>
           <p>Đơn hàng <strong>#${order.order_code}</strong> của bạn đã được tiếp nhận.</p>
           
           <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
             <thead style="background-color: #f9f9f9;">
               <tr>
                 <th style="padding: 10px; text-align: left;">Sản phẩm</th>
                 <th style="padding: 10px;">SL</th>
                 <th style="padding: 10px; text-align: right;">Giá</th>
                 <th style="padding: 10px; text-align: right;">Tổng</th>
               </tr>
             </thead>
             <tbody>
               ${itemsHtml}
             </tbody>
           </table>

           <div style="text-align: right; margin-top: 20px;">
              <p>Thành tiền: ${this.formatCurrency(order.total_amount)}</p>
              <p style="color: red;">Giảm giá: -${this.formatCurrency(order.discount_amount || 0)}</p>
              <h3>Tổng cộng: ${this.formatCurrency(order.total_amount)}</h3>
           </div>
        </div>
        
        <div style="background-color: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #666;">
           Mọi thắc mắc vui lòng liên hệ hotline 1900 xxxx
        </div>
      </div>
    `;
  }

  async sendRefundAlert(
    adminEmail: string,
    refundData: {
      order_code: string;
      amount: number;
      method: string;
      reason?: string;
    },
  ) {
    await this.mailerService.sendMail({
      to: adminEmail,
      subject: `[KẾ TOÁN] Yêu cầu hoàn tiền đơn hàng #${refundData.order_code}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #dc3545; border-radius: 8px; max-width: 600px;">
          <div style="background-color: #dc3545; color: white; padding: 10px; text-align: center; border-radius: 5px 5px 0 0;">
            <h2 style="margin: 0;">YÊU CẦU HOÀN TIỀN</h2>
          </div>
          
          <div style="padding: 20px;">
            <p>Hệ thống ghi nhận đơn hàng sau cần được hoàn tiền do <b>Hủy đơn sau khi đã thanh toán Online</b>.</p>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Mã đơn hàng:</b></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">#${refundData.order_code}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Số tiền cần hoàn:</b></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; color: #dc3545; font-weight: bold;">
                  ${this.formatCurrency(refundData.amount)}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Phương thức gốc:</b></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${refundData.method}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Lý do hủy:</b></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${refundData.reason || 'Không có lý do cụ thể'}</td>
              </tr>
            </table>

            <p style="margin-top: 20px; font-size: 14px; color: #666;">
              <i>Vui lòng truy cập cổng thanh toán (${refundData.method}) để thực hiện hoàn tiền cho khách. 
              Sau khi hoàn tất, hãy cập nhật trạng thái đơn hàng thành <b>REFUNDED</b>.</i>
            </p>
          </div>
        </div>
      `,
    });
  }

  private formatCurrency(amount: number) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  async sendRepaymentLink(
    email: string,
    orderCode: string,
    paymentLink: string,
  ) {
    await this.mailerService.sendMail({
      to: email,
      subject: `[H&N Odyssey] Thanh toán lại đơn hàng #${orderCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px;">
          
          <div style="text-align: center; border-bottom: 2px solid #dc3545; padding-bottom: 15px; margin-bottom: 20px;">
            <h2 style="color: #dc3545; margin: 0;">THANH TOÁN CHƯA HOÀN TẤT</h2>
          </div>

          <p>Xin chào,</p>
          <p>Chúng tôi nhận thấy giao dịch thanh toán cho đơn hàng <b>#${orderCode}</b> chưa thành công.</p>
          
          <p style="background-color: #fff3cd; padding: 10px; border-radius: 5px; color: #856404;">
            ⚠️ Hệ thống đang <b>giữ hàng cho bạn trong vòng 15 phút</b>. Vui lòng hoàn tất thanh toán để tránh đơn hàng bị hủy.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${paymentLink}" 
               style="display: inline-block; padding: 12px 25px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
               THANH TOÁN LẠI NGAY
            </a>
          </div>

          <p style="font-size: 13px; color: #666;">
            <i>Link này chỉ có hiệu lực trong thời gian giữ hàng. Nếu bạn đã thanh toán thành công, vui lòng bỏ qua email này.</i>
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="text-align: center; font-size: 12px; color: #999;">H&N Odyssey Team</p>
        </div>
      `,
    });
  }

  // THÊM MỚI: Gửi xác nhận tạo Ticket hỗ trợ (AC5)
  async sendTicketConfirmation(email: string, messageContent: string) {
    const currentYear = new Date().getFullYear();

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
        
        <div style="background-color: #000000; color: #ffffff; padding: 25px 20px; text-align: center;">
           <h2 style="margin: 0; letter-spacing: 2px; font-size: 24px;">H&N ODYSSEY</h2>
        </div>
        
        <div style="padding: 30px 25px;">
          <h3 style="color: #333333; margin-top: 0; font-size: 20px;">Yêu Cầu Hỗ Trợ Đã Được Ghi Nhận</h3>
          <p style="color: #555555; line-height: 1.6; font-size: 15px;">Xin chào,</p>
          <p style="color: #555555; line-height: 1.6; font-size: 15px;">
            Cảm ơn bạn đã liên hệ với bộ phận CSKH của <strong>H&N Odyssey</strong>. Chúng tôi đã nhận được yêu cầu hỗ trợ của bạn với nội dung chi tiết như sau:
          </p>
          
          <div style="background-color: #f8f9fa; border-left: 4px solid #000000; padding: 15px 20px; margin: 25px 0; color: #444444; font-style: italic; border-radius: 0 4px 4px 0;">
            "${messageContent}"
          </div>
          
          <p style="color: #555555; line-height: 1.6; font-size: 15px;">
            Đội ngũ hỗ trợ đang tiến hành kiểm tra và sẽ phản hồi lại cho bạn qua email này trong vòng <strong>24 giờ làm việc</strong>.
          </p>
          <p style="color: #555555; line-height: 1.6; font-size: 15px;">
            Nếu có thêm bất kỳ thông tin nào cần bổ sung (hình ảnh, video báo lỗi...), bạn vui lòng trả lời <em>(Reply)</em> trực tiếp email này.
          </p>
          
          <p style="color: #555555; line-height: 1.6; font-size: 15px; margin-bottom: 0; margin-top: 30px;">
            Trân trọng,<br>
            <strong style="color: #000000;">Đội ngũ H&N Odyssey</strong>
          </p>
        </div>
        
        <div style="background-color: #f1f1f1; padding: 20px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee;">
           &copy; ${currentYear} H&N Odyssey. All rights reserved.<br><br>
           Hotline: 1900 xxxx | Email: support@hnodyssey.com
        </div>
        
      </div>
    `;

    await this.mailerService.sendMail({
      to: email,
      subject: '[H&N Odyssey] Xác nhận tiếp nhận yêu cầu hỗ trợ',
      html: htmlContent,
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
