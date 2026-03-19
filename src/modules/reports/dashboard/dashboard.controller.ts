import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { BaseResponse } from 'src/common/dtos/base-response.dto';

@Controller('reports/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // [US3 - AC3] Widget Cảnh báo tồn kho
  @Get('stock-alerts')
  @Roles(Role.SUPER_ADMIN, Role.WAREHOUSE_MANAGER, Role.WAREHOUSE_STAFF)
  async getStockAlertsWidget() {
    const data = await this.dashboardService.getStockAlertsWidget();
    return new BaseResponse(
      true,
      'Lấy danh sách cảnh báo tồn kho thành công',
      data,
    );
  }
}
