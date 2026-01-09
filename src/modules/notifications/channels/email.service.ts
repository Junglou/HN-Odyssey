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

  //THÊM MỚI: Gửi hóa đơn bán hàng
  async sendInvoice(email: string, order: any, pdfBuffer?: Buffer) {
    // 1. Tạo nội dung các dòng sản phẩm (HTML)
    const itemsHtml = order.items
      .map(
        (item) => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px; color: #333;">
            ${item.product_name} <br/>
            <small style="color: #777;">SKU: ${item.sku}</small>
          </td>
          <td style="padding: 10px; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; text-align: right;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}</td>
          <td style="padding: 10px; text-align: right; font-weight: bold;">
            ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price * item.quantity)}
          </td>
        </tr>
      `,
      )
      .join('');

    // 2. Tính toán hiển thị tiền tệ
    const subtotal = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(order.total_amount + (order.discount_amount || 0));
    const discount = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(order.discount_amount || 0);
    const total = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(order.total_amount);

    // 3. Chuẩn bị nội dung HTML đầy đủ
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px;">
          
          <div style="text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 20px;">
            <h2 style="color: #007bff; margin: 0;">CẢM ƠN QUÝ KHÁCH!</h2>
            <p style="color: #555;">Đơn hàng <b>#${order.order_code}</b> của bạn đã được xác nhận.</p>
          </div>

          <div style="margin-bottom: 20px;">
            <p><strong>Người nhận:</strong> ${order.shipping_info?.name}</p>
            <p><strong>Số điện thoại:</strong> ${order.shipping_info?.phone}</p>
            <p><strong>Địa chỉ:</strong> ${order.shipping_info?.address}</p>
            <p><strong>Ngày đặt:</strong> ${new Date(order.createdAt).toLocaleString('vi-VN')}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead style="background-color: #f8f9fa;">
              <tr>
                <th style="padding: 10px; text-align: left;">Sản phẩm</th>
                <th style="padding: 10px; text-align: center;">SL</th>
                <th style="padding: 10px; text-align: right;">Đơn giá</th>
                <th style="padding: 10px; text-align: right;">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="text-align: right; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px;">
            <p style="margin: 5px 0;">Tạm tính: ${subtotal}</p>
            <p style="margin: 5px 0; color: #dc3545;">Giảm giá: -${discount}</p>
            <p style="margin: 5px 0; font-size: 18px; font-weight: bold; color: #007bff;">Tổng cộng: ${total}</p>
          </div>

          <div style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
            <p>Đây là email tự động, vui lòng không trả lời.<br/>H&N Odyssey - Hotline: 1900 xxxx</p>
          </div>
        </div>
      `;

    // 4. Cấu hình file đính kèm (nếu có)
    const attachments: any[] = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `Invoice-${order.order_code}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
    }

    // 5. Gửi mail (GỌI 1 LẦN DUY NHẤT)
    await this.mailerService.sendMail({
      to: email,
      subject: `[H&N Odyssey] Hóa đơn điện tử #${order.order_code}`,
      html: htmlContent,
      attachments: attachments, // Mảng file đính kèm
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
