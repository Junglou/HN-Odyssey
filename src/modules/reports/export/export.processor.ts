import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import * as ExcelJS from 'exceljs';
import { ConfigService } from '@nestjs/config';
import { BusinessReportsService } from '../business/business-reports.service';
import { ReportFilterDto } from 'src/common/dtos/report-filter.dto';
import { EmailService } from 'src/modules/notifications/channels/email.service';

interface IExportJobData {
  filter: ReportFilterDto;
  metadata: { exportedBy: string; role: string; exportTime: string };
  emailTo: string;
}

@Processor('export-reports') // Tên Queue phải trùng với tên đã đăng ký trong ExportModule
export class ExportReportProcessor {
  private readonly logger = new Logger(ExportReportProcessor.name);

  constructor(
    private readonly reportsService: BusinessReportsService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  @Process('generate-excel')
  async handleGenerateExcel(job: Job<IExportJobData>) {
    this.logger.log(`Bắt đầu xử lý xuất báo cáo ngầm. JobId: ${job.id}`);
    const { filter, metadata, emailTo } = job.data;

    try {
      const workbook = new ExcelJS.Workbook();

      // Sử dụng metadata để gán tác giả cho file Excel
      workbook.creator = metadata.exportedBy;
      workbook.lastModifiedBy = metadata.exportedBy;

      const sheet = workbook.addWorksheet('Dữ liệu khổng lồ');

      // Do 'filter' đã được định nghĩa type nên truyền vào không còn bị unsafe-argument
      const data =
        await this.reportsService.getInventorySalesCorrelation(filter);

      sheet.getRow(1).values = [
        'SKU',
        'Tên SP',
        'Đã Bán',
        'Tồn Kho',
        'Phân Loại',
      ];

      data.forEach((item, idx) => {
        sheet.getRow(idx + 2).values = [
          item.sku,
          item.productName,
          item.totalSold,
          item.currentStock,
          item.classification,
        ];
      });

      // Lưu ra Storage (S3 hoặc disk nội bộ)
      const fileName = `export_${Date.now()}.xlsx`;
      const filePath = `./uploads/exports/${fileName}`; // Giả lập path
      await workbook.xlsx.writeFile(filePath);

      // Gửi Email
      this.logger.log(`Xuất thành công. Gửi email link tải tới ${emailTo}...`);

      // Sử dụng hàm sendRaw có sẵn trong EmailService của bạn
      const downloadLink = `https://domain.com/download/${fileName}`; // Config domain thực tế sau
      await this.emailService.sendRaw(
        emailTo,
        '[H&N Odyssey] Báo cáo dữ liệu của bạn đã hoàn tất',
        `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h3>Xin chào ${metadata.exportedBy},</h3>
            <p>Báo cáo dữ liệu khổng lồ mà bạn yêu cầu xuất đã được hệ thống xử lý xong.</p>
            <p>Vui lòng click vào nút bên dưới để tải về file Excel:</p>
            <a href="${downloadLink}" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Tải Báo Cáo
            </a>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">
              Báo cáo được xuất lúc: ${new Date(metadata.exportTime).toLocaleString('vi-VN')}
            </p>
          </div>
        `,
      );

      return { success: true, fileName };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Lỗi xử lý Job Export: ${msg}`);
      throw error;
    }
  }
}
