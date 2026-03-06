import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as bwipjs from 'bwip-js';
import { OrderData, OrderItem } from 'src/common/interfaces/oder.interface';

@Injectable()
export class PdfService {
  async generateInvoice(
    order: OrderData,
    isCopy: boolean = false,
  ): Promise<Buffer> {
    try {
      await bwipjs.toBuffer({
        bcid: 'code128',
        text: order.order_code,
        scale: 3,
        height: 10,
        includetext: false,
        textxalign: 'center',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Không thể tạo barcode:', msg);
    }

    // TẠO PDF (STREAM ĐỒNG BỘ)
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
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

      // Cấu hình Font
      const fontRegularPath = path.join(
        process.cwd(),
        'dist/common/fonts/Roboto-Regular.ttf',
      );
      const fontBoldPath = path.join(
        process.cwd(),
        'dist/common/fonts/Roboto-Bold.ttf',
      );

      // 2. Đăng ký Font
      try {
        doc.registerFont('Roboto-Regular', fontRegularPath);
        doc.registerFont('Roboto-Bold', fontBoldPath);

        // 3. Set font mặc định
        doc.font('Roboto-Regular');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('Không load được font, fallback về Helvetica. Lỗi:', msg);
        doc.font('Helvetica');
      }

      // Vẽ Barcode Watermark
      if (isCopy) {
        doc.save();
        doc.rotate(-45, { origin: [300, 400] });
        doc.fontSize(60);
        doc.fillColor('gray');
        doc.opacity(0.3);
        doc.text('BẢN SAO', 150, 400, { align: 'center', width: 300 });
        doc.restore();
        doc.opacity(1);
        doc.fillColor('black');
      }

      // GENERATE CONTENT
      this.generateHeader(doc);
      this.generateCustomerInformation(doc, order);
      this.generateInvoiceTable(doc, order);
      this.generateFooter(doc);

      doc.end();
    });
  }

  // Helper: Header
  private generateHeader(doc: typeof PDFDocument) {
    doc
      .fontSize(20)
      .font('Roboto-Bold')
      .text('H&N ODYSSEY', 50, 57)
      .font('Roboto-Regular')
      .fontSize(10)
      .text('Website: www.hn-odyssey.com', 200, 65, { align: 'right' })
      .text('Hotline: 1900 xxxx', 200, 80, { align: 'right' })
      .moveDown();
  }

  // Helper: Thông tin khách
  private generateCustomerInformation(
    doc: typeof PDFDocument,
    order: OrderData,
  ) {
    const shipping = order.shipping_info;

    doc.fillColor('#444444').fontSize(20).text('HÓA ĐƠN BÁN HÀNG', 50, 160);

    this.generateHr(doc, 185);

    const customerTop = 200;

    doc
      .fontSize(10)
      .text('Mã đơn hàng:', 50, customerTop)
      .font('Roboto-Bold')
      .text(order.order_code, 150, customerTop)
      .font('Roboto-Regular')

      .text('Ngày đặt:', 50, customerTop + 15)
      .text(
        // Thêm || Date.now() để đảm bảo luôn có giá trị ngày tháng
        new Date(order.createdAt || Date.now()).toLocaleDateString('vi-VN'),
        150,
        customerTop + 15,
      )

      .text('Tổng tiền:', 50, customerTop + 30)
      .text(this.formatCurrency(order.total_amount), 150, customerTop + 30)

      .text('Khách hàng:', 300, customerTop)
      .font('Roboto-Bold')
      .text(shipping?.name || 'N/A', 400, customerTop)
      .font('Roboto-Regular')

      .text('Điện thoại:', 300, customerTop + 15)
      .text(shipping?.phone || 'N/A', 400, customerTop + 15)

      .text('Địa chỉ:', 300, customerTop + 30)
      // Cho phép địa chỉ xuống dòng nếu dài quá
      .text(shipping?.address || 'N/A', 400, customerTop + 30, {
        width: 150,
        align: 'left',
      });

    this.generateHr(doc, 252);
  }

  // Helper: Bảng sản phẩm
  private generateInvoiceTable(doc: typeof PDFDocument, order: OrderData) {
    const invoiceTableTop = 330;

    // Header bảng
    doc.font('Roboto-Bold');
    this.generateTableRow(
      doc,
      invoiceTableTop,
      'STT',
      'Sản phẩm',
      'Đơn giá',
      'SL',
      'Thành tiền',
    );
    this.generateHr(doc, invoiceTableTop + 20);
    doc.font('Roboto-Regular');

    let position = invoiceTableTop + 30; // Vị trí bắt đầu in items

    for (let i = 0; i < order.items.length; i++) {
      const item: OrderItem = order.items[i];
      const nameColWidth = 170; // Độ rộng cột Tên sản phẩm

      // 1. Tính toán chiều cao thực tế của tên sản phẩm
      const nameHeight = doc.heightOfString(item.product_name, {
        width: nameColWidth,
        align: 'left',
      });

      // 2. Chọn chiều cao dòng: Ít nhất là 20, hoặc cao hơn nếu tên dài
      const rowHeight = Math.max(nameHeight, 20);

      // 3. Kiểm tra ngắt trang (Nếu còn ít hơn 50px ở cuối trang)
      if (position + rowHeight > 700) {
        doc.addPage();
        position = 50; // Reset về đầu trang mới
      }

      this.generateTableRow(
        doc,
        position,
        (i + 1).toString(),
        item.product_name,
        this.formatCurrency(item.price),
        item.quantity.toString(),
        this.formatCurrency(item.price * item.quantity),
        nameColWidth,
      );

      this.generateHr(doc, position + rowHeight + 10);

      // 4. Cộng dồn vị trí cho dòng tiếp theo
      position += rowHeight + 20;
    }

    // Tổng kết
    const subtotalPosition = position + 20;

    doc.font('Roboto-Bold');
    this.generateTableRow(
      doc,
      subtotalPosition,
      '',
      '',
      'Tạm tính',
      '',
      this.formatCurrency(order.total_amount + (order.discount_amount || 0)),
    );

    this.generateTableRow(
      doc,
      subtotalPosition + 20,
      '',
      '',
      'Giảm giá',
      '',
      '-' + this.formatCurrency(order.discount_amount || 0),
    );

    doc.fontSize(12).fillColor('#007bff');
    this.generateTableRow(
      doc,
      subtotalPosition + 45,
      '',
      '',
      'TỔNG CỘNG',
      '',
      this.formatCurrency(order.total_amount),
    );
    doc.font('Roboto-Regular').fontSize(10).fillColor('black');
  }

  // Helper: Footer
  private generateFooter(doc: typeof PDFDocument) {
    doc
      .fontSize(10)
      .text('Cảm ơn quý khách đã mua hàng tại H&N Odyssey.', 50, 700, {
        align: 'center',
        width: 500,
      });
  }

  // Utils: Vẽ dòng kẻ
  private generateHr(doc: typeof PDFDocument, y: number) {
    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, y)
      .lineTo(550, y)
      .stroke();
  }

  // Utils: Vẽ một dòng trong bảng
  private generateTableRow(
    doc: typeof PDFDocument,
    y: number,
    c1: string,
    c2: string,
    c3: string,
    c4: string,
    c5: string,
    c2Width: number = 170,
  ) {
    doc
      .fontSize(10)
      .text(c1, 50, y)
      .text(c2, 100, y, { width: c2Width, align: 'left' })
      .text(c3, 280, y, { width: 90, align: 'right' })
      .text(c4, 370, y, { width: 90, align: 'right' })
      .text(c5, 0, y, { align: 'right' });
  }

  // Utils: Format tiền tệ
  private formatCurrency(amount: number) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }
}
