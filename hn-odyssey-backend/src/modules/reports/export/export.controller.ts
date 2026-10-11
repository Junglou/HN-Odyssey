import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DashboardFilterDto } from 'src/common/dtos/dashboard-filter.dto';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { ExportPdfDto } from './dto/export-pdf.dto';
import { ExportReportService, type IExportMetadata } from './export.service';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

interface RequestWithUser extends Request {
  user?: {
    _id?: string;
    email?: string;
    fullName?: string;
    roles?: unknown;
    role?: unknown;
  };
}

const toRoleNames = (raw: unknown): string[] => {
  const list: unknown[] = Array.isArray(raw)
    ? (raw as unknown[])
    : raw
      ? [raw]
      : [];
  return list
    .map((r) => {
      if (typeof r === 'string') return r;
      if (r && typeof r === 'object' && 'name' in r) {
        const name = (r as { name: unknown }).name;
        return typeof name === 'string' ? name : '';
      }
      return '';
    })
    .filter((s) => s.length > 0);
};

@Controller('admin/reports/export')
export class ExportController {
  private readonly logger = new Logger(ExportController.name);

  constructor(private readonly exportService: ExportReportService) {}

  // US.95 AC1, AC3, AC4, AC6
  @Get('revenue/excel')
  @RequirePermissions(Resource.REPORT_REVENUE, Action.EXPORT)
  async exportRevenueExcel(
    @Query() filter: DashboardFilterDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<void> {
    const metadata = this.buildMetadata(req);
    const result = await this.run('Excel', () =>
      this.exportService.exportRevenueToExcel(
        filter,
        metadata,
        req.user?.email ?? '',
      ),
    );

    if (result.kind === 'queued') {
      res.status(HttpStatus.ACCEPTED).json({
        success: true,
        message: result.message,
        data: { jobId: result.jobId },
      });
      return;
    }

    this.sendFile(
      res,
      result.buffer,
      `Doanh_Thu_${Date.now()}.xlsx`,
      XLSX_MIME,
    );
  }

  // US.95 AC2, AC6, AC7: Xuất PDF tại biểu đồ (Doanh thu hoặc Marketing)
  @Post('chart/pdf')
  @HttpCode(200)
  @RequirePermissions(
    [Resource.REPORT_REVENUE, Resource.REPORT_MARKETING],
    Action.EXPORT,
  )
  async exportChartPdf(
    @Body() body: ExportPdfDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<void> {
    const metadata = this.buildMetadata(req);
    const pdf = await this.run('PDF', () =>
      this.exportService.exportChartToPdf(
        {
          imageBase64: body.chartImageBase64,
          title: body.title,
          period: body.period,
          orientation: body.orientation,
        },
        metadata,
      ),
    );
    this.sendFile(res, pdf, `Bieu_Do_${Date.now()}.pdf`, 'application/pdf');
  }

  // US.95 AC7: Tên + email người thực hiện
  private buildMetadata(req: RequestWithUser): IExportMetadata {
    const user = req.user;
    const roles = toRoleNames(user?.roles ?? user?.role);
    const identity = user?.email ?? user?._id ?? 'unknown';
    return {
      exportedBy: user?.fullName ? `${user.fullName} - ${identity}` : identity,
      role: roles.length > 0 ? roles.join(', ') : 'N/A',
      department: 'BOD',
      exportTime: new Date(),
    };
  }

  private async run<T>(label: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Xuất ${label} thất bại: ${msg}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        `Lỗi khi xuất file ${label}: ${msg}`,
      );
    }
  }

  private sendFile(
    res: Response,
    buffer: Buffer,
    fileName: string,
    mime: string,
  ): void {
    res.set({
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    });
    res.end(buffer);
  }
}
