import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
  Post,
  HttpCode,
  Body,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { ExportReportService } from './export.service';
import { DashboardFilterDto } from 'src/common/dtos/dashboard-filter.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { Workbook } from 'exceljs';
import { ExportPdfDto } from './dto/export-pdf.dto';

interface RequestWithUser extends Request {
  user: { email: string; roles: string[]; userId: string };
}

@Controller('admin/reports/export')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExportController {
  constructor(private readonly exportService: ExportReportService) {}

  @Get('revenue/excel')
  @RequirePermissions(Resource.REPORTS, Action.EXPORT) // AC6: Ràng buộc quyền Export
  async exportRevenueExcel(
    @Query() filter: DashboardFilterDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    try {
      const metadata = {
        exportedBy: req.user.email,
        role: req.user.roles.join(','),
        department: 'BOD', // Có thể lookup từ DB
        exportTime: new Date(),
      };

      const result = await this.exportService.exportRevenueToExcel(
        filter,
        metadata,
      );

      // Nếu dữ liệu quá lớn (Xử lý Async)
      if (!(result instanceof Workbook)) {
        return res.status(HttpStatus.ACCEPTED).json({
          success: true,
          message: result.message,
        });
      }

      // Xử lý tải file trực tiếp
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Doanh_Thu_${Date.now()}.xlsx`,
      );

      await result.xlsx.write(res);
      res.end();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        `Lỗi khi xuất file Excel: ${msg}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Thêm API endpoint xử lý xuất PDF
  @Post('chart/pdf')
  @HttpCode(200)
  @RequirePermissions(Resource.REPORTS, Action.EXPORT) // Phân quyền AC6
  async exportChartPdf(
    @Body() body: ExportPdfDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    try {
      const metadata = {
        exportedBy: req.user.email,
        role: req.user.roles.join(','),
        department: 'BOD',
        exportTime: new Date(),
      };

      const pdfBuffer = await this.exportService.exportChartToPdf(
        body.chartImageBase64,
        body.title,
        metadata,
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Bieu_Do_${Date.now()}.pdf`,
      );

      res.send(pdfBuffer);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        `Lỗi khi xuất file PDF: ${msg}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
