import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Resource, Action } from 'src/common/enums/resource.enum';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import {
  DashboardFilterDto,
  TopEntityFilterDto,
} from 'src/common/dtos/dashboard-filter.dto';

@Controller('reports/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // [US3 - AC3] Widget Cảnh báo tồn kho
  @Get('stock-alerts')
  @RequirePermissions(Resource.DASHBOARD, Action.READ)
  async getStockAlertsWidget() {
    const data = await this.dashboardService.getStockAlertsWidget();
    return new BaseResponse(
      true,
      'Lấy danh sách cảnh báo tồn kho thành công',
      data,
    );
  }

  // Thống kê doanh thu và đơn hàng
  @Get('overview')
  @RequirePermissions(Resource.DASHBOARD, Action.READ)
  async getOverview(@Query() query: DashboardFilterDto) {
    const data = await this.dashboardService.getOverviewStats(query);
    return new BaseResponse(true, 'Lấy thống kê tổng quan thành công', data);
  }

  // Thống kê sản phẩm bán chạy
  @Get('top-products')
  @RequirePermissions(Resource.DASHBOARD, Action.READ)
  async getTopProducts(@Query() query: TopEntityFilterDto) {
    const data = await this.dashboardService.getTopProducts(query);
    return new BaseResponse(
      true,
      'Lấy thống kê sản phẩm bán chạy thành công',
      data,
    );
  }

  // Thống kê danh mục bán chạy
  @Get('top-categories')
  @RequirePermissions(Resource.DASHBOARD, Action.READ)
  async getTopCategories(@Query() query: TopEntityFilterDto) {
    const data = await this.dashboardService.getTopCategories(query);
    return new BaseResponse(
      true,
      'Lấy thống kê danh mục bán chạy thành công',
      data,
    );
  }

  // Thêm API endpoint
  @Get('recent-orders')
  @RequirePermissions(Resource.DASHBOARD, Action.READ)
  async getRecentOrders() {
    const data = await this.dashboardService.getRecentOrders(10);
    return new BaseResponse(
      true,
      'Lấy danh sách đơn hàng vừa đặt thành công',
      data,
    );
  }
}
