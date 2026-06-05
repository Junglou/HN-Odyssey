import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import { MonitoringService } from './monitoring.service';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';

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
  @RequirePermissions(Resource.SYSTEM, Action.READ)
  async getPerformanceStats(
    @Query('timeframe') timeframe?: string,
    @Query('node') node?: string,
  ) {
    const data = await this.monitoringService.getPerformanceStats(
      timeframe,
      node,
    );
    return new BaseResponse(true, 'Lấy hiệu năng hệ thống thành công', data);
  }

  // US5 - Trạng thái API đối tác
  @Get('third-party-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions(Resource.SYSTEM, Action.READ)
  async getThirdPartyStatus(@Query('timeframe') timeframe?: string) {
    const data = await this.monitoringService.getThirdPartyStatus(timeframe);
    return new BaseResponse(true, 'Lấy trạng thái đối tác thành công', data);
  }

  // US1 - AC2: Đèn trạng thái tổng quan
  @Get('status-widget')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions(Resource.SYSTEM, Action.READ)
  async getSystemStatusWidget(
    @Query('timeframe') timeframe?: string,
    @Query('node') node?: string,
  ) {
    const data = await this.monitoringService.getSystemStatusWidget(
      timeframe,
      node,
    );
    return new BaseResponse(true, 'Lấy trạng thái hệ thống thành công', data);
  }

  // US1-AC6 & US2-AC6: Lịch sử hiệu năng vẽ biểu đồ
  @Get('performance-history-24h')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions(Resource.SYSTEM, Action.READ)
  async getPerformanceHistory(
    @Query('timeframe') timeframe?: string,
    @Query('node') node?: string,
  ) {
    const data = await this.monitoringService.getPerformanceHistory24h(
      timeframe,
      node,
    );
    return new BaseResponse(true, 'Lấy lịch sử hiệu năng thành công', data);
  }

  // US3 - AC6: Lấy lịch sử lỗi giao dịch thanh toán
  @Get('payment-errors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions(Resource.SYSTEM, Action.READ)
  async getPaymentErrors(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('provider') provider?: string,
    @Query('timeframe') timeframe?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    const data = await this.monitoringService.getPaymentErrorLogs(
      p,
      l,
      provider,
      timeframe,
    );
    return new BaseResponse(
      true,
      'Lấy lịch sử lỗi thanh toán thành công',
      data,
    );
  }

  // Cung cấp dữ liệu cho Gauge overview
  @Get('resources-current')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions(Resource.SYSTEM, Action.READ)
  async getCurrentResources(@Query('node') node?: string) {
    const data = await this.monitoringService.getCurrentResources(node);
    return new BaseResponse(true, 'Lấy tài nguyên hiện tại thành công', data);
  }

  // Cung cấp dữ liệu cho biểu đồ LineChart CPU/RAM
  @Get('resources-history-24h')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions(Resource.SYSTEM, Action.READ)
  async getResourceHistory(
    @Query('timeframe') timeframe?: string,
    @Query('node') node?: string,
  ) {
    const data = await this.monitoringService.getResourceHistory24h(
      timeframe,
      node,
    );
    return new BaseResponse(true, 'Lấy lịch sử tài nguyên thành công', data);
  }

  // US4 - Lấy log bảo mật đã được gom nhóm số lần vi phạm
  @Get('security-logs-recent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions(Resource.SYSTEM, Action.READ)
  async getSecurityLogsRecent(@Query('timeframe') timeframe?: string) {
    const data =
      await this.monitoringService.getAggregatedSecurityLogs(timeframe);
    return new BaseResponse(true, 'Lấy log bảo mật thành công', data);
  }
}
