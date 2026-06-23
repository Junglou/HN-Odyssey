import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { BusinessReportsService } from '../business/business-reports.service';
import { DashboardFilterDto } from 'src/common/dtos/dashboard-filter.dto';
import PDFDocument from 'pdfkit';
import * as path from 'path';

export interface IExportMetadata {
  exportedBy: string; // Tên nhân viên hoặc ID người dùng
  role: string;
  department: string;
  exportTime: Date;
}

@Injectable()
export class ExportReportService {
  private readonly logger = new Logger(ExportReportService.name);

  constructor(private readonly businessReportService: BusinessReportsService) {}

  // AC1, AC3, AC5, AC7: Xuất dữ liệu Bảng Doanh Thu ra Excel có Metadata
  // Bản thiết kế: Giao diện chuyên nghiệp (Corporate Style)

  async exportRevenueToExcel(
    filter: DashboardFilterDto,
    metadata: IExportMetadata,
  ): Promise<ExcelJS.Workbook | { isAsync: boolean; message: string }> {
    // KIỂM TRA AC4: Nếu dữ liệu lớn (> 1 năm), xử lý ngầm (Async Background)
    if (filter.start_date && filter.end_date) {
      const start = new Date(filter.start_date);
      const end = new Date(filter.end_date);
      const diffDays = Math.ceil(
        Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays > 365) {
        this.logger.log(
          `Dữ liệu > 365 ngày (${diffDays} days). Chuyển sang xử lý ngầm.`,
        );
        return {
          isAsync: true,
          message:
            'Dữ liệu quá lớn. Hệ thống đang xử lý ngầm và sẽ gửi link tải qua Email của bạn khi hoàn tất.',
        };
      }
    }

    // 1. Khởi tạo Workbook & Cấu hình cơ bản
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'H&N Odyssey System';
    workbook.lastModifiedBy = metadata.exportedBy;
    workbook.created = metadata.exportTime;

    // Thiết lập tùy chọn Freeze Panes: Cố định 5 dòng đầu (Header + Metadata)
    const sheet = workbook.addWorksheet('Báo Cáo Doanh Thu', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }],
    });

    // 2. Định dạng Tiêu đề chính (Main Title)
    sheet.mergeCells('A1:C1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'BÁO CÁO DOANH THU & ĐƠN HÀNG';
    titleCell.font = {
      name: 'Arial',
      size: 16,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' }, // Xanh dương đậm chuẩn doanh nghiệp
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // 3. Metadata và Tham số bộ lọc (AC7 & AC3)
    sheet.getCell('A2').value =
      `Người xuất: ${metadata.exportedBy} (${metadata.role})`;
    sheet.getCell('A3').value =
      `Thời gian xuất: ${metadata.exportTime.toLocaleString('vi-VN')}`;

    let filterInfo = 'Bộ lọc áp dụng: Toàn thời gian';
    if (filter.start_date && filter.end_date) {
      filterInfo = `Bộ lọc áp dụng: Từ ngày ${filter.start_date} đến ${filter.end_date}`;
    }
    sheet.getCell('A4').value = filterInfo;
    sheet.getCell('A4').font = { italic: true, color: { argb: 'FF555555' } }; // Chữ xám in nghiêng

    // 4. Setup cấu trúc Cột và Tiêu đề Cột (Headers)
    sheet.columns = [
      { key: 'time', width: 25 },
      { key: 'orders', width: 20 },
      { key: 'revenue', width: 30 },
    ];

    const headerRow = sheet.getRow(5);
    headerRow.values = ['Thời Gian', 'Số Đơn Hàng', 'Tổng Doanh Thu (VND)'];
    headerRow.font = {
      name: 'Arial',
      size: 12,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2F75B5' }, // Xanh lam nhạt hơn so với Main Title
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Bật Auto-Filter tự động cho dòng Header
    sheet.autoFilter = 'A5:C5';

    // 5. Đổ dữ liệu từ Service và Kẻ viền (Borders)
    const reportData =
      await this.businessReportService.getRevenueReport(filter);

    let rowIndex = 6;
    for (const item of reportData.timeline) {
      const row = sheet.getRow(rowIndex);

      row.getCell(1).value = item.label;
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      row.getCell(2).value = Number(item.orders);
      row.getCell(2).numFmt = '#,##0';
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

      row.getCell(3).value = Number(item.revenue);
      row.getCell(3).numFmt = '#,##0 "₫"';
      row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' }; // Tiền tệ luôn canh phải

      // Áp dụng Borders (Kẻ viền) cho từng ô
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        };
      });

      // Zebra Striping (Tô màu xen kẽ các dòng để dễ đọc)
      if (rowIndex % 2 === 0) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9F9F9' }, // Màu xám cực nhạt
          };
        });
      }

      rowIndex++;
    }

    // 6. Dòng Tổng cộng (Summary Row) nổi bật ở cuối bảng
    const totalRow = sheet.getRow(rowIndex);

    totalRow.getCell(1).value = 'TỔNG CỘNG';
    totalRow.getCell(1).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    // Tính tổng số đơn hàng
    const totalOrders = reportData.timeline.reduce(
      (acc, curr) => acc + curr.orders,
      0,
    );
    totalRow.getCell(2).value = totalOrders;
    totalRow.getCell(2).numFmt = '#,##0';
    totalRow.getCell(2).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    totalRow.getCell(3).value = reportData.currentTotalRevenue;
    totalRow.getCell(3).numFmt = '#,##0 "₫"';
    totalRow.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    // Styling đặc biệt cho dòng Tổng
    totalRow.font = { bold: true, color: { argb: 'FF9C0006' } }; // Chữ đỏ sậm
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFC7CE' }, // Nền hồng nhạt
    };

    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'double', color: { argb: 'FF9C0006' } }, // Viền đôi ở trên
        bottom: { style: 'medium', color: { argb: 'FF9C0006' } }, // Viền đậm ở dưới
        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      };
    });

    return workbook;
  }

  // AC2, AC7: Xuất biểu đồ ra tài liệu PDF kèm định danh Metadata

  async exportChartToPdf(
    chartImageBase64: string,
    title: string,
    metadata: IExportMetadata,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Thiết lập lề 40 cho không gian thoáng đãng
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });

        // 1. Cấu hình Font chữ Unicode
        const fontPath = path.join(
          process.cwd(),
          'src/common/fonts/SVN-Arial Regular.ttf',
        );
        doc.font(fontPath);

        // 2. Vẽ khung viền trang trí (Professional Border)
        doc
          .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
          .lineWidth(1)
          .stroke('#1F4E78'); // Màu xanh dương đậm chuẩn Corporate

        // 3. HEADER: Tên hệ thống & Mã báo cáo
        doc
          .fillColor('#1F4E78')
          .fontSize(10)
          .text('H&N ODYSSEY E-COMMERCE SYSTEM', 40, 40);
        doc
          .fillColor('#666666')
          .fontSize(8)
          .text(`Mã trích xuất: ${Date.now()}`, { align: 'right' });

        // Đường kẻ ngang dưới Header
        doc.moveTo(40, 55).lineTo(555, 55).lineWidth(0.5).stroke('#EEEEEE');

        // 4. TIÊU ĐỀ CHÍNH: In hoa, đậm, canh giữa
        doc.moveDown(2);
        const upperTitle = title.toUpperCase();
        doc
          .fillColor('#000000')
          .fontSize(22)
          .text(upperTitle, { align: 'center' });

        //  ĐÃ FIX LỖI titleWidth TẠI ĐÂY
        const titleWidth = doc.widthOfString(upperTitle);
        const centerX = doc.page.width / 2;
        const lineMargin = 10; // Khoảng cách thừa ra 2 bên tiêu đề cho đẹp

        doc
          .moveTo(centerX - titleWidth / 2 - lineMargin, doc.y + 5)
          .lineTo(centerX + titleWidth / 2 + lineMargin, doc.y + 5)
          .lineWidth(2)
          .stroke('#1F4E78');

        // 5. THÔNG TIN ĐỊNH DANH (Metadata)
        doc.moveDown(2);
        const infoY = doc.y;

        // Vẽ một khối màu nhạt làm nền cho phần thông tin
        doc.rect(40, infoY - 5, 515, 55).fill('#F8F9FA');

        doc
          .fillColor('#333333')
          .fontSize(10)
          .text(`Người xuất báo cáo: `, 50, infoY, { continued: true })
          .fillColor('#000000')
          .text(`${metadata.exportedBy} (${metadata.role})`)
          .fillColor('#333333')
          .text(`Thời gian hệ thống: `, { continued: true })
          .fillColor('#000000')
          .text(metadata.exportTime.toLocaleString('vi-VN'))
          .fillColor('#333333')
          .text(`Phòng ban phụ trách: `, { continued: true })
          .fillColor('#000000')
          .text(metadata.department);

        // 6. HIỂN THỊ BIỂU ĐỒ (AC2)
        doc.moveDown(3);
        const base64Data = chartImageBase64.replace(
          /^data:image\/\w+;base64,/,
          '',
        );
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Căn giữa hình ảnh và thêm khung bóng cho ảnh
        doc.image(imageBuffer, {
          fit: [500, 350],
          align: 'center',
        });

        // 7. FOOTER: Bản quyền & Ghi chú bảo mật
        const footerY = doc.page.height - 65;
        doc
          .moveTo(40, footerY)
          .lineTo(555, footerY)
          .lineWidth(1)
          .stroke('#1F4E78');

        doc
          .fillColor('#999999')
          .fontSize(8)
          .text(
            'Tài liệu mật - Chỉ sử dụng lưu hành nội bộ H&N Odyssey. Mọi hành vi sao chép trái phép phải chịu trách nhiệm trước pháp luật.',
            40,
            footerY + 10,
            { align: 'center', width: 515 },
          );

        doc.end();
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}
