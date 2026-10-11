import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Resource, Action } from 'src/common/enums/resource.enum';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import {
  DashboardFilterDto,
  TopEntityFilterDto,
} from 'src/common/dtos/dashboard-filter.dto';

@Controller('reports/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('inventory-kpis')
  @RequirePermissions(Resource.DASHBOARD, Action.READ)
  async getInventoryKPIs() {
    const data = await this.dashboardService.getInventoryKPIs();
    return new BaseResponse(true, 'Fetch inventory KPIs successfully', data);
  }

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

  // Cho phép 3 nhóm quyền cùng truy cập API tổng quan
  @Get('overview')
  @RequirePermissions(
    [Resource.DASHBOARD, Resource.REPORT_REVENUE, Resource.REPORT_MARKETING],
    Action.READ,
  )
  async getOverview(@Query() query: DashboardFilterDto) {
    const data = await this.dashboardService.getOverviewStats(query);
    return new BaseResponse(true, 'Lấy thống kê tổng quan thành công', data);
  }

  // Cho phép 3 nhóm quyền cùng truy cập API sản phẩm bán chạy
  @Get('top-products')
  @RequirePermissions(
    [Resource.DASHBOARD, Resource.REPORT_REVENUE, Resource.REPORT_MARKETING],
    Action.READ,
  )
  async getTopProducts(@Query() query: TopEntityFilterDto) {
    const data = await this.dashboardService.getTopProducts(query);
    return new BaseResponse(
      true,
      'Lấy thống kê sản phẩm bán chạy thành công',
      data,
    );
  }

  @Get('top-categories')
  @RequirePermissions(
    [Resource.DASHBOARD, Resource.REPORT_REVENUE],
    Action.READ,
  )
  async getTopCategories(@Query() query: TopEntityFilterDto) {
    const data = await this.dashboardService.getTopCategories(query);
    return new BaseResponse(
      true,
      'Lấy thống kê danh mục bán chạy thành công',
      data,
    );
  }

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
