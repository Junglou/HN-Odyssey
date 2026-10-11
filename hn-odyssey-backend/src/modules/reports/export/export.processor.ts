import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bull';
import { plainToInstance } from 'class-transformer';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { DashboardFilterDto } from 'src/common/dtos/dashboard-filter.dto';
import { formatVnDateTime } from 'src/common/utils/date-range.util';
import { EmailService } from 'src/modules/notifications/channels/email.service';
import {
  EXPORT_JOB_REVENUE_EXCEL,
  EXPORT_QUEUE,
  ExportReportService,
  type IRevenueExportJob,
} from './export.service';

@Processor(EXPORT_QUEUE)
export class ExportReportProcessor {
  private readonly logger = new Logger(ExportReportProcessor.name);

  constructor(
    private readonly exportService: ExportReportService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  @Process(EXPORT_JOB_REVENUE_EXCEL)
  async handleRevenueExcel(job: Job<IRevenueExportJob>) {
    const { filter, metadata, emailTo } = job.data;
    this.logger.log(`Bắt đầu job ${String(job.id)} cho ${emailTo}`);

    // Job data đi qua Redis dạng JSON nên phải dựng lại DTO & Date
    const exportTime = new Date(metadata.exportTime);
    const workbook = await this.exportService.buildRevenueWorkbook(
      plainToInstance(DashboardFilterDto, filter),
      { ...metadata, exportTime },
    );

    // ServeStaticModule đang serve <root>/uploads tại /uploads
    const exportDir = path.join(process.cwd(), 'uploads', 'exports');
    await fs.mkdir(exportDir, { recursive: true });

    // Tên ngẫu nhiên để link không đoán được
    const fileName = `Doanh_Thu_${randomUUID()}.xlsx`;
    await workbook.xlsx.writeFile(path.join(exportDir, fileName));

    const appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    const downloadLink = `${appUrl}/uploads/exports/${fileName}`;

    await this.emailService.sendRaw(
      emailTo,
      '[H&N Odyssey] Báo cáo doanh thu của bạn đã sẵn sàng',
      `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h3>Xin chào ${metadata.exportedBy},</h3>
          <p>Báo cáo doanh thu bạn yêu cầu đã được xử lý xong.</p>
          <a href="${downloadLink}" style="display:inline-block;padding:10px 20px;background:#1F4E78;color:#fff;text-decoration:none;border-radius:5px;font-weight:bold;">
            Tải báo cáo
          </a>
          <p style="margin-top:20px;font-size:12px;color:#666;">
            Yêu cầu lúc: ${formatVnDateTime(exportTime)}
          </p>
        </div>
      `,
    );

    return { success: true, fileName };
  }

  @OnQueueFailed()
  onFailed(job: Job<IRevenueExportJob>, error: Error) {
    this.logger.error(
      `Job ${String(job.id)} thất bại (lần ${job.attemptsMade}): ${error.message}`,
    );
  }
}
