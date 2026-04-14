import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import { MonitoringService } from './monitoring.service';

@Controller('admin/system-monitoring')
export class MonitoringController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongooseHealth: MongooseHealthIndicator,
    private readonly memoryHealth: MemoryHealthIndicator,
    private readonly monitoringService: MonitoringService,
  ) {}

  // US1 - AC1: Public Health Check Endpoint
  // Terminus tự quản lý logic bên dưới nên không cần đẩy vào MonitoringService
  @Get('health')
  @HealthCheck()
  checkHealth() {
    return this.health.check([
      () => this.mongooseHealth.pingCheck('database'),
      () => this.memoryHealth.checkHeap('memory_heap', 300 * 1024 * 1024), // 300MB
    ]);
  }

  // US2 - Hiệu năng Server
  @Get('performance-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getPerformanceStats() {
    const data = await this.monitoringService.getPerformanceStats();
    return new BaseResponse(true, 'Lấy hiệu năng hệ thống thành công', data);
  }

  // US5 - Trạng thái API đối tác
  @Get('third-party-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getThirdPartyStatus() {
    const data = await this.monitoringService.getThirdPartyStatus();
    return new BaseResponse(true, 'Lấy trạng thái đối tác thành công', data);
  }

  // US1 - AC2: Đèn trạng thái tổng quan
  @Get('status-widget')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getSystemStatusWidget() {
    const data = await this.monitoringService.getSystemStatusWidget();
    return new BaseResponse(true, 'Lấy trạng thái hệ thống thành công', data);
  }

  // US1-AC6 & US2-AC6: Lịch sử hiệu năng vẽ biểu đồ
  @Get('performance-history-24h')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getPerformanceHistory() {
    const data = await this.monitoringService.getPerformanceHistory24h();
    return new BaseResponse(true, 'Lấy lịch sử hiệu năng 24h thành công', data);
  }

  // US3 - AC6: Lấy lịch sử lỗi giao dịch thanh toán
  @Get('payment-errors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getPaymentErrors(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('provider') provider?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;

    const data = await this.monitoringService.getPaymentErrorLogs(
      p,
      l,
      provider,
    );
    return new BaseResponse(
      true,
      'Lấy lịch sử lỗi thanh toán thành công',
      data,
    );
  }
}
