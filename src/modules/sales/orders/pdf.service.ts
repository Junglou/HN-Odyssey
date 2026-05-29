import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as bwipjs from 'bwip-js';
import { OrderData, OrderItem } from 'src/common/interfaces/order.interface';

@Injectable()
export class PdfService {
  private readonly primaryColor = '#1976D2';
  private readonly textColor = '#333333';
  private readonly mutedColor = '#777777';
  private readonly bgColor = '#F9FAFB';

  async generateInvoice(
    order: OrderData,
    isCopy: boolean = false,
  ): Promise<Buffer> {
    // 1. Khởi tạo hình ảnh Barcode từ thư viện trước khi đổ vào PDF
    let barcodeBuffer: Buffer | null = null;
    try {
      barcodeBuffer = await bwipjs.toBuffer({
        bcid: 'code128',
        text: order.order_code,
        scale: 3,
        height: 10,
        includetext: true, // Cho phép hiển thị luôn text mã bên dưới
        textxalign: 'center',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Không thể tạo barcode:', msg);
    }

    // 2. Mở luồng để ghi file PDF
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      // Thu thập dữ liệu stream
      doc.on('data', (buffer: Buffer) => buffers.push(buffer));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.on('error', (err) => {
        if (err instanceof Error) {
          reject(err);
        } else {
          reject(new Error(String(err)));
        }
      });

      // 3. Cấu hình Font chữ để render Tiếng Việt mượt mà
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

      // 4. Đánh dấu bản sao (Watermark) nếu in lại nhiều lần
      if (isCopy) {
        doc.save();
        doc.rotate(-45, { origin: [300, 400] });
        doc.fontSize(60);
        doc.fillColor('gray');
        doc.opacity(0.15); // Giảm độ đậm để không che khuất chữ bên dưới
        doc.text('BẢN SAO', 150, 400, { align: 'center', width: 300 });
        doc.restore();
        doc.opacity(1);
      }

      // 5. Gọi các hàm layout để thiết kế PDF
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

      // Hàm helper để render hàng loạt các đơn nội bộ
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
              'Bulk: Không thể tạo barcode cho đơn',
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

      // Đã bọc object lỗi chuẩn theo quy tắc của eslint prefer-promise-reject-errors
      processBulk().catch((err: unknown) => {
        if (err instanceof Error) {
          reject(err);
        } else {
          reject(new Error(String(err)));
        }
      });
    });
  }

  // Khối 1: Render phần thông tin Logo, Tiêu đề và Barcode
  private generateHeader(
    doc: typeof PDFDocument,
    barcodeBuffer: Buffer | null,
  ) {
    // Tiêu đề thương hiệu bên trái
    doc
      .fontSize(22)
      .font('Roboto-Bold')
      .fillColor(this.primaryColor)
      .text('H&N ODYSSEY', 50, 50)
      .font('Roboto-Regular')
      .fontSize(10)
      .fillColor(this.mutedColor)
      .text('Website: www.hn-odyssey.com', 50, 75)
      .text('Hotline: 1900 xxxx', 50, 90)
      .moveDown();

    // Vẽ Barcode ở góc bên phải trang (nếu có buffer)
    if (barcodeBuffer) {
      doc.image(barcodeBuffer, 400, 50, { width: 140 });
    }
  }

  // Khối 2: Render phần thông tin chung và địa chỉ nhận hàng của khách
  private generateCustomerInformation(
    doc: typeof PDFDocument,
    order: OrderData,
    type: 'INVOICE' | 'PACKING_SLIP',
  ) {
    const shipping = order.shipping_info;

    // Tách cờ nghiệp vụ để xác định luồng Trade-in hay luồng Bán hàng
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

    // Tiêu đề văn bản chỉnh giữa trang
    doc
      .fillColor(this.textColor)
      .fontSize(18)
      .font('Roboto-Bold')
      .text(documentTitle, 50, 130, { align: 'center', width: 500 });

    // Khung background bo góc nền xám nhạt bọc thông tin
    const boxTop = 160;
    doc.roundedRect(50, boxTop, 500, 90, 8).fill(this.bgColor);

    const textTop = boxTop + 15;
    doc.fillColor(this.textColor).fontSize(10).font('Roboto-Regular');

    // --- CỘT TRÁI: THÔNG TIN CHỨNG TỪ (Tọa độ X giá trị đẩy từ 140 -> 175) ---
    doc.text(isTradeIn ? 'Mã yêu cầu:' : 'Mã đơn hàng:', 65, textTop);
    doc.font('Roboto-Bold').text(order.order_code, 175, textTop);

    doc.font('Roboto-Regular').text('Ngày lập:', 65, textTop + 20);
    doc.text(
      new Date(order.createdAt || Date.now()).toLocaleDateString('vi-VN'),
      175,
      textTop + 20,
    );

    if (type === 'INVOICE') {
      doc.text(
        isTradeIn ? 'Hình thức quy đổi:' : 'Thanh toán:',
        65,
        textTop + 40,
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
      doc.text(displayMethod, 175, textTop + 40);
    }

    // --- CỘT PHẢI: THÔNG TIN KHÁCH HÀNG (Tọa độ X giá trị đẩy sang 360) ---
    doc.text('Khách hàng:', 280, textTop);
    doc.font('Roboto-Bold').text(shipping?.name || 'N/A', 360, textTop);

    doc.font('Roboto-Regular').text('Điện thoại:', 280, textTop + 20);
    doc.text(shipping?.phone || 'N/A', 360, textTop + 20);

    doc.text(isTradeIn ? 'Đ/c Thu hồi:' : 'Địa chỉ nhận:', 280, textTop + 40);
    const displayAddress = shipping?.address
      ? shipping.address
      : isTradeIn
        ? 'Giao dịch trực tiếp tại quầy'
        : 'Nhận hàng tại quầy (Admin Order)';

    doc.text(displayAddress, 360, textTop + 40, {
      width: 170,
      align: 'left',
    });
  }

  // Khối 3: Bảng danh sách sản phẩm
  private generateInvoiceTable(
    doc: typeof PDFDocument,
    order: OrderData,
    type: 'INVOICE' | 'PACKING_SLIP',
  ) {
    let position = 280;

    const isTradeIn = order.payment?.method?.startsWith('TRADE-IN');
    const tradeInMethod = isTradeIn ? order.payment.method.split('|')[1] : '';

    // Thanh tiêu đề bảng màu xanh chủ đạo
    doc.rect(50, position - 5, 500, 25).fill(this.primaryColor);
    doc.fillColor('#FFFFFF').font('Roboto-Bold');

    if (type === 'INVOICE') {
      this.generateTableRow(
        doc,
        position,
        'STT',
        'Tên thiết bị / sản phẩm',
        isTradeIn ? 'Định giá' : 'Đơn giá',
        'SL',
        isTradeIn ? 'Mức quy đổi' : 'Thành tiền',
      );
    } else {
      this.generateTableRow(
        doc,
        position,
        'STT',
        'Tên thiết bị / sản phẩm',
        '',
        'SL',
        '',
      );
    }

    doc.fillColor(this.textColor).font('Roboto-Regular');
    position += 30;

    for (let i = 0; i < order.items.length; i++) {
      const item: OrderItem = order.items[i];
      const nameColWidth = 190;

      const nameHeight = doc.heightOfString(item.product_name, {
        width: nameColWidth,
        align: 'left',
      });
      const rowHeight = Math.max(nameHeight, 20);

      // Ngắt trang tự động nếu bảng vượt giới hạn chiều cao khổ giấy A4
      if (position + rowHeight > 750) {
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

      this.generateHr(doc, position + rowHeight + 8);
      position += rowHeight + 15;
    }

    // Khối tổng kết toán chứng từ cuối trang
    if (type === 'INVOICE') {
      position += 15;
      doc.font('Roboto-Regular');

      if (!isTradeIn) {
        this.generateTableRow(
          doc,
          position,
          '',
          '',
          'Tạm tính:',
          '',
          this.formatCurrency(
            order.total_amount + (order.discount_amount || 0),
          ),
        );

        this.generateTableRow(
          doc,
          position + 20,
          '',
          '',
          'Giảm giá:',
          '',
          '- ' + this.formatCurrency(order.discount_amount || 0),
        );
      }

      doc.fontSize(12).font('Roboto-Bold').fillColor(this.primaryColor);

      const finalVal = isTradeIn
        ? this.formatTradeInValue(order.total_amount, tradeInMethod)
        : this.formatCurrency(order.total_amount);

      this.generateTableRow(
        doc,
        isTradeIn ? position : position + 45, // Đẩy khối tổng tiền lên trên nếu là đơn Trade-in
        '',
        '',
        isTradeIn ? 'TỔNG QUY ĐỔI:' : 'TỔNG CỘNG:',
        '',
        finalVal,
      );
      doc.font('Roboto-Regular').fontSize(10).fillColor(this.textColor);
    }
  }

  // Khối 4: Lời cảm ơn góc dưới
  private generateFooter(doc: typeof PDFDocument, order: OrderData) {
    const isTradeIn = order.payment?.method?.startsWith('TRADE-IN');

    const footerText = isTradeIn
      ? 'Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ Thu Cũ Đổi Mới tại H&N Odyssey.'
      : 'Cảm ơn quý khách đã mua hàng tại H&N Odyssey.';

    doc.fontSize(10).fillColor(this.mutedColor).text(footerText, 50, 780, {
      align: 'center',
      width: 500,
    });
  }

  // Helper 1: Dòng gạch chân mỏng
  private generateHr(doc: typeof PDFDocument, y: number) {
    doc
      .strokeColor('#EEEEEE')
      .lineWidth(1)
      .moveTo(50, y)
      .lineTo(550, y)
      .stroke();
  }

  // Helper 2: Tổ chức định vị các cột thẳng hàng trong bảng tính
  private generateTableRow(
    doc: typeof PDFDocument,
    y: number,
    c1: string,
    c2: string,
    c3: string,
    c4: string,
    c5: string,
    c2Width: number = 190,
  ) {
    doc
      .fontSize(10)
      .text(c1, 60, y) // Cột 1: Số thứ tự
      .text(c2, 90, y, { width: c2Width, align: 'left' }) // Cột 2: Sản phẩm
      .text(c3, 300, y, { width: 80, align: 'right' }) // Cột 3: Đơn giá
      .text(c4, 390, y, { width: 40, align: 'right' }) // Cột 4: Số lượng
      .text(c5, 440, y, { width: 100, align: 'right' }); // Cột 5: Thành tiền
  }

  // Helper 3: Format tiền tệ chuẩn xác
  private formatCurrency(amount: number) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  private formatTradeInValue(amount: number, method: string) {
    switch (method) {
      case 'Reward Points':
        return `${amount} Điểm`;
      case 'Service Promotion':
        return `Giảm ${amount}%`;
      case 'Store Credit / Voucher':
      case 'PENDING':
      default:
        // Định dạng $ cho Store Credit hoặc mặc định
        return `$${amount.toFixed(2)}`;
    }
  }
}
