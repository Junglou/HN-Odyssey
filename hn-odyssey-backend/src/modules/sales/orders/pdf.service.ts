import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as bwipjs from 'bwip-js';
import { OrderData, OrderItem } from 'src/common/interfaces/order.interface';

@Injectable()
export class PdfService {
  private readonly brandColor = '#047857'; // Xanh ngọc lục bảo sâu, tạo cảm giác tin cậy
  private readonly textDark = '#1E293B';
  private readonly textMuted = '#64748B';
  private readonly bgLight = '#F8FAFC';
  private readonly borderColor = '#E2E8F0';

  async generateInvoice(
    order: OrderData,
    isCopy: boolean = false,
  ): Promise<Buffer> {
    // Khởi tạo hình ảnh mã vạch từ thư viện bwip-js
    let barcodeBuffer: Buffer | null = null;
    try {
      barcodeBuffer = await bwipjs.toBuffer({
        bcid: 'code128',
        text: order.order_code,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: 'center',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Không thể tạo barcode:', msg);
    }

    // Khởi tạo đối tượng PDFDocument và bắt đầu ghi luồng dữ liệu
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (buffer: Buffer) => buffers.push(buffer));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.on('error', (err) => {
        if (err instanceof Error) {
          reject(err);
        } else {
          reject(new Error(String(err)));
        }
      });

      // Đăng ký font chữ hỗ trợ tiếng Việt
      const fontRegularPath = path.join(
        process.cwd(),
        'dist/common/fonts/Roboto-Regular.ttf',
      );
      const fontBoldPath = path.join(
        process.cwd(),
        'dist/common/fonts/Roboto-Bold.ttf',
      );

      try {
        doc.registerFont('Roboto-Regular', fontRegularPath);
        doc.registerFont('Roboto-Bold', fontBoldPath);
        doc.font('Roboto-Regular');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('Không load được font, fallback về Helvetica. Lỗi:', msg);
        doc.font('Helvetica');
      }

      // Thêm watermark cho các bản in lại nhằm mục đích phân biệt
      if (isCopy) {
        doc.save();
        doc.rotate(-45, { origin: [300, 400] });
        doc.fontSize(60);
        doc.fillColor('#CBD5E1');
        doc.opacity(0.15);
        doc.text('BẢN SAO', 150, 400, { align: 'center', width: 300 });
        doc.restore();
        doc.opacity(1);
      }

      // Cấu trúc và thiết kế các phần tử của trang PDF
      this.generateHeader(doc, barcodeBuffer);
      this.generateCustomerInformation(doc, order, 'INVOICE');
      this.generateInvoiceTable(doc, order, 'INVOICE');
      this.generateFooter(doc, order);

      doc.end();
    });
  }

  async generateBulkDocument(
    orders: OrderData[],
    type: 'INVOICE' | 'PACKING_SLIP',
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (buffer: Buffer) => buffers.push(buffer));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.on('error', (err) => {
        if (err instanceof Error) {
          reject(err);
        } else {
          reject(new Error(String(err)));
        }
      });

      const fontRegularPath = path.join(
        process.cwd(),
        'dist/common/fonts/Roboto-Regular.ttf',
      );
      const fontBoldPath = path.join(
        process.cwd(),
        'dist/common/fonts/Roboto-Bold.ttf',
      );

      try {
        doc.registerFont('Roboto-Regular', fontRegularPath);
        doc.registerFont('Roboto-Bold', fontBoldPath);
        doc.font('Roboto-Regular');
      } catch {
        doc.font('Helvetica');
      }

      // Hàm đóng gói tác vụ kết xuất nhiều đơn hàng vào cùng một tài liệu PDF
      const processBulk = async () => {
        for (let i = 0; i < orders.length; i++) {
          if (i > 0) doc.addPage();
          const order = orders[i];

          let barcodeBuffer: Buffer | null = null;
          try {
            barcodeBuffer = await bwipjs.toBuffer({
              bcid: 'code128',
              text: order.order_code,
              scale: 3,
              height: 10,
              includetext: true,
              textxalign: 'center',
            });
          } catch {
            console.warn(
              'Xử lý hàng loạt: Không thể tạo mã vạch cho đơn',
              order.order_code,
            );
          }

          this.generateHeader(doc, barcodeBuffer);
          this.generateCustomerInformation(doc, order, type);
          this.generateInvoiceTable(doc, order, type);
          this.generateFooter(doc, order);
        }
        doc.end();
      };

      processBulk().catch((err: unknown) => {
        if (err instanceof Error) {
          reject(err);
        } else {
          reject(new Error(String(err)));
        }
      });
    });
  }

  // Xây dựng khu vực tiêu đề bao gồm tên thương hiệu và mã vạch
  private generateHeader(
    doc: typeof PDFDocument,
    barcodeBuffer: Buffer | null,
  ) {
    doc
      .fontSize(24)
      .font('Roboto-Bold')
      .fillColor(this.brandColor)
      .text('H&N ODYSSEY', 50, 45)
      .font('Roboto-Regular')
      .fontSize(10)
      .fillColor(this.textMuted)
      .text('Website: www.hn-odyssey.com', 50, 75)
      .text('Hotline: 1900 xxxx', 50, 90)
      .moveDown();

    if (barcodeBuffer) {
      doc.image(barcodeBuffer, 400, 45, { width: 145 });
    }
  }

  // Cấu trúc khu vực thông tin chứng từ và chi tiết liên hệ của khách hàng
  private generateCustomerInformation(
    doc: typeof PDFDocument,
    order: OrderData,
    type: 'INVOICE' | 'PACKING_SLIP',
  ) {
    const shipping = order.shipping_info;
    const isTradeIn = order.payment?.method?.startsWith('TRADE-IN');
    const tradeInMethod = isTradeIn ? order.payment.method.split('|')[1] : '';

    const documentTitle =
      type === 'INVOICE'
        ? isTradeIn
          ? 'BIÊN LAI ĐỊNH GIÁ THU CŨ'
          : 'HÓA ĐƠN BÁN HÀNG'
        : isTradeIn
          ? 'PHIẾU THU HỒI SẢN PHẨM'
          : 'PHIẾU GIAO HÀNG';

    doc
      .fillColor(this.textDark)
      .fontSize(20)
      .font('Roboto-Bold')
      .text(documentTitle, 50, 135, { align: 'center', width: 495 })
      .fontSize(10)
      .font('Roboto-Regular')
      .fillColor(this.textMuted)
      .text(`Mã chứng từ: ${order.order_code}`, 50, 160, {
        align: 'center',
        width: 495,
      });

    // Vẽ khung bo góc chứa thông tin khách hàng và đơn hàng
    const boxTop = 190;
    doc
      .roundedRect(50, boxTop, 495, 95, 6)
      .fillAndStroke(this.bgLight, this.borderColor);

    const textTop = boxTop + 15;
    doc.fillColor(this.textDark).fontSize(10).font('Roboto-Regular');

    // Nhóm thông tin mã đơn hàng và ngày tạo (Đẩy cột giá trị sang X = 155)
    doc.text(isTradeIn ? 'Mã yêu cầu:' : 'Mã đơn hàng:', 65, textTop);
    doc.font('Roboto-Bold').text(order.order_code, 155, textTop);

    doc.font('Roboto-Regular').text('Ngày lập:', 65, textTop + 22);
    doc.text(
      new Date(order.createdAt || Date.now()).toLocaleDateString('vi-VN'),
      155,
      textTop + 22,
    );

    if (type === 'INVOICE') {
      doc.text(
        isTradeIn ? 'Hình thức quy đổi:' : 'Thanh toán:',
        65,
        textTop + 44,
      );

      let displayMethod = this.formatCurrency(order.total_amount);
      if (isTradeIn) {
        if (tradeInMethod === 'Reward Points')
          displayMethod = 'Cộng điểm thành viên';
        else if (tradeInMethod === 'Service Promotion')
          displayMethod = 'Mã ưu đãi dịch vụ';
        else if (tradeInMethod === 'Store Credit / Voucher')
          displayMethod = 'Voucher mua hàng';
        else displayMethod = 'Chưa chốt / Đang chờ';
      }
      doc.font('Roboto-Bold').text(displayMethod, 155, textTop + 44);
    }

    // Nhóm thông tin liên hệ của khách hàng (Đẩy tiêu đề sang X = 310 và giá trị sang X = 385)
    doc.font('Roboto-Regular').text('Khách hàng:', 310, textTop);
    doc
      .font('Roboto-Bold')
      .text(shipping?.name || 'Khách vãng lai', 385, textTop);

    doc.font('Roboto-Regular').text('Điện thoại:', 310, textTop + 22);
    doc.text(shipping?.phone || 'Không cung cấp', 385, textTop + 22);

    doc.text(isTradeIn ? 'Đ/c Thu hồi:' : 'Địa chỉ nhận:', 310, textTop + 44);
    const displayAddress = shipping?.address
      ? shipping.address
      : isTradeIn
        ? 'Giao dịch trực tiếp tại quầy'
        : 'Nhận hàng tại quầy (Admin Order)';

    doc.text(displayAddress, 385, textTop + 44, {
      width: 155,
      align: 'left',
      lineGap: 2,
    });
  }

  // Tạo bảng chi tiết các sản phẩm trong đơn hàng
  private generateInvoiceTable(
    doc: typeof PDFDocument,
    order: OrderData,
    type: 'INVOICE' | 'PACKING_SLIP',
  ) {
    let position = 315;
    const isTradeIn = order.payment?.method?.startsWith('TRADE-IN');
    const tradeInMethod = isTradeIn ? order.payment.method.split('|')[1] : '';

    // Vẽ hình nền cho tiêu đề của bảng
    doc
      .roundedRect(50, position, 495, 30, 4)
      .fillAndStroke(this.bgLight, this.borderColor);

    doc.fillColor(this.textDark).font('Roboto-Bold');

    const tableHeaders = {
      stt: 'STT',
      name: 'Tên thiết bị / sản phẩm',
      price: isTradeIn ? 'Định giá' : 'Đơn giá',
      qty: 'SL',
      total: isTradeIn ? 'Mức quy đổi' : 'Thành tiền',
    };

    if (type === 'INVOICE') {
      this.generateTableRow(
        doc,
        position + 9,
        tableHeaders.stt,
        tableHeaders.name,
        tableHeaders.price,
        tableHeaders.qty,
        tableHeaders.total,
      );
    } else {
      this.generateTableRow(
        doc,
        position + 9,
        tableHeaders.stt,
        tableHeaders.name,
        '',
        tableHeaders.qty,
        '',
      );
    }

    doc.fillColor(this.textDark).font('Roboto-Regular');
    position += 40;

    for (let i = 0; i < order.items.length; i++) {
      const item: OrderItem = order.items[i];
      const nameColWidth = 200;

      const nameHeight = doc.heightOfString(item.product_name, {
        width: nameColWidth,
        align: 'left',
      });
      const rowHeight = Math.max(nameHeight, 20);

      // Xử lý ngắt trang khi danh sách sản phẩm quá dài
      if (position + rowHeight > 700) {
        doc.addPage();
        position = 50;
      }

      if (type === 'INVOICE') {
        const rowVal = isTradeIn
          ? this.formatTradeInValue(item.price, tradeInMethod)
          : this.formatCurrency(item.price);
        const rowTotal = isTradeIn
          ? this.formatTradeInValue(item.price * item.quantity, tradeInMethod)
          : this.formatCurrency(item.price * item.quantity);

        this.generateTableRow(
          doc,
          position,
          (i + 1).toString(),
          item.product_name,
          rowVal,
          item.quantity.toString(),
          rowTotal,
          nameColWidth,
        );
      } else {
        this.generateTableRow(
          doc,
          position,
          (i + 1).toString(),
          item.product_name,
          '',
          item.quantity.toString(),
          '',
          nameColWidth,
        );
      }

      this.generateHr(doc, position + rowHeight + 10);
      position += rowHeight + 20;
    }

    // Tính toán và hiển thị phần tổng kết chi phí
    if (type === 'INVOICE') {
      position += 10;
      doc.font('Roboto-Regular');

      if (!isTradeIn) {
        this.generateSummaryRow(
          doc,
          position,
          'Tạm tính:',
          this.formatCurrency(
            order.total_amount + (order.discount_amount || 0),
          ),
        );

        this.generateSummaryRow(
          doc,
          position + 22,
          'Giảm giá:',
          `- ${this.formatCurrency(order.discount_amount || 0)}`,
        );
        position += 44;
      }

      // Khối hiển thị tổng số tiền thanh toán cuối cùng
      doc.fontSize(12).font('Roboto-Bold').fillColor(this.brandColor);
      const finalVal = isTradeIn
        ? this.formatTradeInValue(order.total_amount, tradeInMethod)
        : this.formatCurrency(order.total_amount);

      this.generateSummaryRow(
        doc,
        position,
        isTradeIn ? 'TỔNG QUY ĐỔI:' : 'TỔNG CỘNG:',
        finalVal,
      );

      doc.font('Roboto-Regular').fontSize(10).fillColor(this.textDark);
    }
  }

  // Cấu hình đoạn văn bản cảm ơn tại phần chân trang
  private generateFooter(doc: typeof PDFDocument, order: OrderData) {
    const isTradeIn = order.payment?.method?.startsWith('TRADE-IN');

    const footerText = isTradeIn
      ? 'Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ Thu Cũ Đổi Mới tại H&N Odyssey.'
      : 'Cảm ơn quý khách đã mua hàng tại H&N Odyssey.';

    doc.fontSize(10).fillColor(this.textMuted).text(footerText, 50, 780, {
      align: 'center',
      width: 495,
    });
  }

  // Hàm hỗ trợ vẽ đường kẻ ngang mờ phân cách giữa các hàng
  private generateHr(doc: typeof PDFDocument, y: number) {
    doc
      .strokeColor(this.borderColor)
      .lineWidth(0.5)
      .moveTo(50, y)
      .lineTo(545, y)
      .stroke();
  }

  // Hàm hỗ trợ canh lề và định vị văn bản trong các cột của bảng
  private generateTableRow(
    doc: typeof PDFDocument,
    y: number,
    c1: string,
    c2: string,
    c3: string,
    c4: string,
    c5: string,
    c2Width: number = 200,
  ) {
    doc
      .fontSize(10)
      .text(c1, 60, y)
      .text(c2, 100, y, { width: c2Width, align: 'left' })
      .text(c3, 310, y, { width: 75, align: 'right' })
      .text(c4, 395, y, { width: 40, align: 'center' })
      .text(c5, 445, y, { width: 90, align: 'right' });
  }

  // Hàm hỗ trợ canh lề chuyên biệt cho phần tóm tắt chi phí
  private generateSummaryRow(
    doc: typeof PDFDocument,
    y: number,
    label: string,
    value: string,
  ) {
    doc
      .text(label, 310, y, { width: 125, align: 'right' })
      .text(value, 445, y, { width: 90, align: 'right' });
  }

  // Chuyển đổi định dạng số nguyên thành chuỗi tiền tệ VND
  private formatCurrency(amount: number) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  // Xử lý các quy tắc định dạng riêng biệt cho quy trình Thu Cũ Đổi Mới
  private formatTradeInValue(amount: number, method: string) {
    switch (method) {
      case 'Reward Points':
        return `${amount} Điểm`;
      case 'Service Promotion':
        return `Giảm ${amount}%`;
      case 'Store Credit / Voucher':
      case 'PENDING':
      default:
        return `$${amount.toFixed(2)}`;
    }
  }
}
