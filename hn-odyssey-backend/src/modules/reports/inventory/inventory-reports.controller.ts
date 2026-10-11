import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { InventoryReportsService } from './inventory-reports.service';
import { GetXntReportDto, DrillDownQueryDto } from './dto/query-xnt-report.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { BaseResponse } from 'src/common/dtos/base-response.dto';

interface RequestWithUser extends Request {
  user: {
    _id: string;
    email: string;
    roles: string[];
  };
}

@Controller('reports/inventory')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class InventoryReportsController {
  constructor(private readonly reportsService: InventoryReportsService) {}

  @Get('trend')
  // [SỬA]: Sử dụng REPORT_STOCK vì đây là báo cáo Inventory Management
  @RequirePermissions(Resource.REPORT_STOCK, Action.READ)
  async getInventoryTrend(@Query() query: GetXntReportDto) {
    const data = await this.reportsService.getInventoryTrend(query);
    return new BaseResponse(
      true,
      'Fetch stock movement trend successfully',
      data,
    );
  }

  // F.112 & F.113: Xem và Lọc báo cáo XNT
  @Get('xnt')
  // [SỬA]: Sử dụng REPORT_STOCK vì đây là báo cáo Inventory Management
  // [SỬA]: Thay đổi Action.EXPORT thành Action.READ (Quyền xem bảng báo cáo)
  @RequirePermissions(Resource.REPORT_STOCK, Action.READ)
  async getXntReport(@Query() query: GetXntReportDto) {
    const result = await this.reportsService.getXntReport(query);
    return new BaseResponse(
      true,
      'Lấy báo cáo Xuất Nhập Tồn thành công',
      result.data,
      {
        totalItems: result.total,
        itemCount: result.data.length, // Đã bổ sung thuộc tính bắt buộc
        currentPage: result.page,
        itemsPerPage: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    );
  }

  // Drill-down: Xem chi tiết dòng chảy hàng hóa của 1 SKU
  @Get('xnt/:sku/drill-down')
  // [SỬA]: Sử dụng REPORT_STOCK
  @RequirePermissions(Resource.REPORT_STOCK, Action.READ)
  async getDrillDown(
    @Param('sku') sku: string,
    @Query() query: DrillDownQueryDto,
  ) {
    const result = await this.reportsService.getSkuDrillDown(sku, query);
    // Chuẩn hóa luôn meta cho hàm này để đồng bộ và tránh lỗi tương tự
    return new BaseResponse(true, `Chi tiết thẻ kho SKU: ${sku}`, result.data, {
      totalItems: result.total,
      itemCount: result.data.length,
      currentPage: result.page,
      itemsPerPage: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    });
  }

  // F.114: Xuất Excel
  @Get('xnt/export/excel')
  // [SỬA]: Sử dụng REPORT_STOCK và giữ quyền EXPORT
  @RequirePermissions(Resource.REPORT_STOCK, Action.EXPORT)
  async exportExcel(
    @Query() query: GetXntReportDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const actorId = req.user._id;
    await this.reportsService.exportXntExcel(query, actorId, res);
  }

  // F.114: Xuất PDF
  @Get('xnt/export/pdf')
  // [SỬA]: Sử dụng REPORT_STOCK và giữ quyền EXPORT
  @RequirePermissions(Resource.REPORT_STOCK, Action.EXPORT)
  async exportPdf(
    @Query() query: GetXntReportDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const actorId = req.user._id;
    await this.reportsService.exportXntPdf(query, actorId, res);
  }

  // F.xxx: Lấy dữ liệu tổng quan KPI cho Dashboard Báo Cáo
  @Get('kpi-summary')
  @RequirePermissions(Resource.REPORT_STOCK, Action.READ)
  async getKpiSummary(@Query() query: GetXntReportDto) {
    const data = await this.reportsService.getKpiSummary(query);
    return new BaseResponse(
      true,
      'Fetch inventory KPI summary successfully',
      data,
    );
  }
}
