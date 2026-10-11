import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import { BusinessReportsService } from '../business/business-reports.service';
import { DashboardFilterDto } from 'src/common/dtos/dashboard-filter.dto';
import {
  DAY_MS,
  formatVnDate,
  formatVnDateTime,
  getReportDateRange,
} from 'src/common/utils/date-range.util';

export const EXPORT_QUEUE = 'export-reports';
export const EXPORT_JOB_REVENUE_EXCEL = 'generate-revenue-excel';
const ASYNC_THRESHOLD_DAYS = 365;

export interface IExportMetadata {
  exportedBy: string; // Email hoặc ID người xuất
  role: string;
  department: string;
  exportTime: Date;
}

export interface IRevenueExportJob {
  filter: DashboardFilterDto;
  metadata: Omit<IExportMetadata, 'exportTime'> & { exportTime: string };
  emailTo: string;
}

export type RevenueExportResult =
  | { kind: 'file'; buffer: Buffer }
  | { kind: 'queued'; message: string; jobId: string };

@Injectable()
export class ExportReportService {
  private readonly logger = new Logger(ExportReportService.name);

  constructor(
    private readonly businessReportService: BusinessReportsService,
    @InjectQueue(EXPORT_QUEUE)
    private readonly exportQueue: Queue<IRevenueExportJob>,
  ) {}

  // AC1, AC3, AC4, AC5, AC7: Xuất Excel doanh thu (> 365 ngày → xử lý ngầm)
  async exportRevenueToExcel(
    filter: DashboardFilterDto,
    metadata: IExportMetadata,
    emailTo: string,
  ): Promise<RevenueExportResult> {
    const { start, end } = getReportDateRange(filter);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / DAY_MS);

    if (diffDays > ASYNC_THRESHOLD_DAYS) {
      if (!emailTo) {
        throw new BadRequestException(
          'Tài khoản không có email để nhận file báo cáo.',
        );
      }

      const job = await this.exportQueue.add(
        EXPORT_JOB_REVENUE_EXCEL,
        {
          filter: { ...filter },
          metadata: {
            ...metadata,
            exportTime: metadata.exportTime.toISOString(),
          },
          emailTo,
        },
        {
          attempts: 2,
          backoff: 10_000,
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );

      this.logger.log(
        `Revenue export ${diffDays} ngày → queued, jobId=${String(job.id)}`,
      );

      return {
        kind: 'queued',
        jobId: String(job.id),
        message: `Khoảng thời gian ${diffDays} ngày quá lớn. Hệ thống đang xử lý ngầm và sẽ gửi link tải tới ${emailTo}.`,
      };
    }

    const workbook = await this.buildRevenueWorkbook(filter, metadata);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return { kind: 'file', buffer: Buffer.from(arrayBuffer) };
  }

  // Dùng chung cho tải trực tiếp và job chạy ngầm (export.processor.ts)
  async buildRevenueWorkbook(
    filter: DashboardFilterDto,
    metadata: IExportMetadata,
  ): Promise<ExcelJS.Workbook> {
    // 1. Khởi tạo Workbook & cấu hình cơ bản
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'H&N Odyssey System';
    workbook.lastModifiedBy = metadata.exportedBy;
    workbook.created = metadata.exportTime;

    // Cố định 5 dòng đầu (Header + Metadata)
    const sheet = workbook.addWorksheet('Báo Cáo Doanh Thu', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }],
    });

    // 2. Tiêu đề chính
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
      fgColor: { argb: 'FF1F4E78' },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // 3. Metadata & tham số bộ lọc (AC7 & AC3)
    sheet.getCell('A2').value =
      `Người xuất: ${metadata.exportedBy} (${metadata.role})`;
    sheet.getCell('A3').value =
      `Thời gian xuất: ${formatVnDateTime(metadata.exportTime)}`;

    const filterInfo =
      filter.start_date && filter.end_date
        ? `Bộ lọc áp dụng: Từ ${formatVnDate(filter.start_date)} đến ${formatVnDate(filter.end_date)}`
        : `Bộ lọc áp dụng: ${filter.time_filter ?? 'TODAY'}`;
    sheet.getCell('A4').value = filterInfo;
    sheet.getCell('A4').font = { italic: true, color: { argb: 'FF555555' } };

    // 4. Cấu trúc cột & header
    sheet.columns = [
      { key: 'time', width: 25 },
      { key: 'orders', width: 20 },
      { key: 'revenue', width: 30 },
    ];

    const headerRow = sheet.getRow(5);
    headerRow.values = ['Thời Gian', 'Số Đơn Hàng', 'Tổng Doanh Thu (USD)'];
    headerRow.font = {
      name: 'Arial',
      size: 12,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2F75B5' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.autoFilter = 'A5:C5';

    // 5. Đổ dữ liệu & kẻ viền
    const reportData =
      await this.businessReportService.getRevenueReport(filter);

    let rowIndex = 6;
    for (const item of reportData.timeline) {
      const row = sheet.getRow(rowIndex);

      // US.95 AC5: cột Thời gian là kiểu Ngày tháng thật
      // (khung giờ "13:00" khi xem Hôm nay thì giữ dạng chữ)
      const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(item.label);
      if (dayMatch) {
        row.getCell(1).value = new Date(
          Date.UTC(
            Number(dayMatch[1]),
            Number(dayMatch[2]) - 1,
            Number(dayMatch[3]),
          ),
        );
        row.getCell(1).numFmt = 'dd/mm/yyyy';
      } else {
        row.getCell(1).value = item.label;
      }
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      row.getCell(2).value = Number(item.orders);
      row.getCell(2).numFmt = '#,##0';
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

      row.getCell(3).value = Number(item.revenue);
      row.getCell(3).numFmt = '"$"#,##0.00';
      row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        };
      });

      // Zebra striping
      if (rowIndex % 2 === 0) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9F9F9' },
          };
        });
      }

      rowIndex++;
    }

    // 6. Dòng tổng cộng
    const totalRow = sheet.getRow(rowIndex);

    totalRow.getCell(1).value = 'TỔNG CỘNG';
    totalRow.getCell(1).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    const totalOrders = reportData.timeline.reduce(
      (acc, curr) => acc + Number(curr.orders),
      0,
    );
    totalRow.getCell(2).value = totalOrders;
    totalRow.getCell(2).numFmt = '#,##0';
    totalRow.getCell(2).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    totalRow.getCell(3).value = reportData.currentTotalRevenue;
    totalRow.getCell(3).numFmt = '"$"#,##0.00';
    totalRow.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

    totalRow.font = { bold: true, color: { argb: 'FF9C0006' } };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFC7CE' },
    };

    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'double', color: { argb: 'FF9C0006' } },
        bottom: { style: 'medium', color: { argb: 'FF9C0006' } },
        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      };
    });

    return workbook;
  }

  // US.95 AC2, AC7: Đóng gói ảnh biểu đồ thành PDF kèm metadata định danh
  async exportChartToPdf(
    options: {
      imageBase64: string;
      title: string;
      period?: string;
      orientation?: 'portrait' | 'landscape';
    },
    metadata: IExportMetadata,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
          layout: options.orientation ?? 'portrait',
        });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Kích thước thật của trang (khổ dọc 595×842, khổ ngang 842×595)
        const margin = 40;
        const pageW = doc.page.width;
        const pageH = doc.page.height;
        const contentW = pageW - margin * 2;
        const footerY = pageH - 65;

        // 1. Font Unicode
        const fontPath = path.join(
          process.cwd(),
          'src/common/fonts/SVN-Arial Regular.ttf',
        );
        doc.font(fontPath);

        // 2. Khung viền trang
        doc
          .rect(20, 20, pageW - 40, pageH - 40)
          .lineWidth(1)
          .stroke('#1F4E78');

        // 3. Header: tên hệ thống (trái) + mã trích xuất (phải)
        doc
          .fillColor('#1F4E78')
          .fontSize(10)
          .text('H&N ODYSSEY E-COMMERCE SYSTEM', margin, 36, {
            width: contentW,
            align: 'left',
            lineBreak: false,
          });
        doc
          .fillColor('#666666')
          .fontSize(8)
          .text(`Mã trích xuất: ${Date.now()}`, margin, 38, {
            width: contentW,
            align: 'right',
            lineBreak: false,
          });
        doc
          .moveTo(margin, 54)
          .lineTo(pageW - margin, 54)
          .lineWidth(0.5)
          .stroke('#DDDDDD');

        // 4. Tiêu đề chính
        const upperTitle = options.title.toUpperCase();
        doc
          .fillColor('#000000')
          .fontSize(20)
          .text(upperTitle, margin, 70, { width: contentW, align: 'center' });

        const titleWidth = Math.min(doc.widthOfString(upperTitle), contentW);
        const underlineY = doc.y + 4;
        doc
          .moveTo(pageW / 2 - titleWidth / 2 - 10, underlineY)
          .lineTo(pageW / 2 + titleWidth / 2 + 10, underlineY)
          .lineWidth(2)
          .stroke('#1F4E78');

        // 5. Thông tin định danh (AC7) + kỳ báo cáo (AC3)
        const infoLines: Array<[string, string]> = [
          ['Người xuất báo cáo: ', `${metadata.exportedBy} (${metadata.role})`],
          ['Thời gian xuất: ', formatVnDateTime(metadata.exportTime)],
          ['Phòng ban phụ trách: ', metadata.department],
        ];
        if (options.period) infoLines.push(['Kỳ báo cáo: ', options.period]);

        const lineHeight = 15;
        const infoTop = underlineY + 16;
        const infoHeight = infoLines.length * lineHeight + 12;
        doc.rect(margin, infoTop, contentW, infoHeight).fill('#F8F9FA');

        doc.fontSize(10);
        infoLines.forEach(([label, value], idx) => {
          doc
            .fillColor('#333333')
            .text(label, margin + 10, infoTop + 6 + idx * lineHeight, {
              continued: true,
            })
            .fillColor('#000000')
            .text(value);
        });

        // 6. Ảnh biểu đồ: dùng hết khoảng trống còn lại phía trên footer
        const base64Data = options.imageBase64.replace(
          /^data:image\/\w+;base64,/,
          '',
        );
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const imageTop = infoTop + infoHeight + 16;
        const availableHeight = Math.max(80, footerY - 12 - imageTop);
        doc.image(imageBuffer, margin, imageTop, {
          fit: [contentW, availableHeight],
          align: 'center',
        });

        // 7. Footer
        doc
          .moveTo(margin, footerY)
          .lineTo(pageW - margin, footerY)
          .lineWidth(1)
          .stroke('#1F4E78');

        doc
          .fillColor('#999999')
          .fontSize(8)
          .text(
            'Tài liệu mật - Chỉ sử dụng lưu hành nội bộ H&N Odyssey. Mọi hành vi sao chép trái phép phải chịu trách nhiệm trước pháp luật.',
            margin,
            footerY + 10,
            { align: 'center', width: contentW },
          );

        doc.end();
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}
