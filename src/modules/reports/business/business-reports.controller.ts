import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BusinessReportsService } from './business-reports.service';
import { DashboardFilterDto } from 'src/common/dtos/dashboard-filter.dto';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import {
  IRevenueReport,
  IRetentionReport,
} from 'src/common/interfaces/business-report.interface';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { ReportFilterDto } from 'src/common/dtos/report-filter.dto';

@Controller('admin/reports/business')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class BusinessReportsController {
  constructor(private readonly reportsService: BusinessReportsService) {}

  @Get('revenue')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermissions(Resource.REPORTS, Action.READ)
  async getRevenueReport(
    @Query() filter: DashboardFilterDto,
  ): Promise<BaseResponse<IRevenueReport>> {
    const data = await this.reportsService.getRevenueReport(filter);
    return new BaseResponse(true, 'Lấy báo cáo doanh thu thành công', data);
  }

  @Get('retention')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermissions(Resource.REPORTS, Action.READ)
  async getRetentionReport(
    @Query() filter: DashboardFilterDto,
  ): Promise<BaseResponse<IRetentionReport>> {
    const data = await this.reportsService.getRetentionReport(filter);
    return new BaseResponse(
      true,
      'Lấy báo cáo tỷ lệ giữ chân thành công',
      data,
    );
  }

  @Get('abandoned-carts')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermissions(Resource.REPORTS, Action.READ)
  async getAbandonedCarts(@Query() filter: DashboardFilterDto) {
    const data = await this.reportsService.getAbandonedProducts(filter);
    return new BaseResponse(
      true,
      'Lấy danh sách sản phẩm bị bỏ quên thành công',
      data,
    );
  }

  @Get('conversion')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermissions(Resource.REPORTS, Action.READ)
  async getConversionReport(@Query() filter: DashboardFilterDto) {
    const data = await this.reportsService.getConversionReport(filter);
    return new BaseResponse(
      true,
      'Lấy báo cáo chuyển đổi và phễu thành công',
      data,
    );
  }

  @Get('behavior-abandonment')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermissions(Resource.REPORTS, Action.READ)
  async getBehaviorAndAbandonmentReport(@Query() filter: DashboardFilterDto) {
    const data =
      await this.reportsService.getBounceAndAbandonmentReport(filter);
    return new BaseResponse(
      true,
      'Lấy báo cáo tỷ lệ thoát và bỏ dở thanh toán thành công',
      data,
    );
  }

  //  CÁC ROUTE NÂNG CAO (BI ADVANCED)

  @Get('inventory-correlation')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermissions(Resource.REPORTS, Action.READ)
  async getInventoryCorrelation(@Query() filter: ReportFilterDto) {
    const data = await this.reportsService.getInventorySalesCorrelation(filter);
    return new BaseResponse(
      true,
      'Lấy báo cáo tương quan tồn kho - doanh số thành công',
      data,
    );
  }

  @Get('yoy-comparison')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermissions(Resource.REPORTS, Action.READ)
  async getYoYComparison(@Query('year') year: string) {
    const targetYear = year || new Date().getFullYear().toString();
    const data = await this.reportsService.getYoYComparison(targetYear);
    return new BaseResponse(
      true,
      'Lấy báo cáo so sánh cùng kỳ (YoY) thành công',
      data,
    );
  }

  @Get('forecast')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermissions(Resource.REPORTS, Action.READ)
  async getRevenueForecast() {
    const data = await this.reportsService.getRevenueForecast();
    return new BaseResponse(
      true,
      'Lấy dự báo doanh thu tương lai thành công',
      data,
    );
  }
}
