import { Body, Controller, Get, Ip, Put, Query } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import { MonitoringService } from './monitoring.service';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UserAgent } from 'src/common/decorators/user-agent.decorator';
import type { IUser } from 'src/common/interfaces/user.interface';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { UpdateThresholdsDto } from './dto/update-thresholds.dto';

// Guard JWT → Roles → Permissions đã đăng ký global ở app.module, không cần @UseGuards lại
@Controller('admin/system-monitoring')
export class MonitoringController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongooseHealth: MongooseHealthIndicator,
    private readonly memoryHealth: MemoryHealthIndicator,
    private readonly monitoringService: MonitoringService,
  ) {}

  // US1 - AC1: Public Health Check Endpoint (dùng được cho cả công cụ uptime bên ngoài)
  @Get('health')
  @Public()
  @HealthCheck()
  checkHealth() {
    return this.health.check([
      () => this.mongooseHealth.pingCheck('database'),
      () => this.memoryHealth.checkHeap('memory_heap', 300 * 1024 * 1024), // 300MB
    ]);
  }

  // US2 - Hiệu năng Server
  @Get('performance-stats')
  @RequirePermissions(Resource.SYSTEM_MONITORING, Action.READ)
  async getPerformanceStats(@Query('timeframe') timeframe?: string) {
    const data = await this.monitoringService.getPerformanceStats(timeframe);
    return new BaseResponse(true, 'Lấy hiệu năng hệ thống thành công', data);
  }

  // US5 - Trạng thái API đối tác
  @Get('third-party-status')
  @RequirePermissions(Resource.SYSTEM_MONITORING, Action.READ)
  async getThirdPartyStatus(@Query('timeframe') timeframe?: string) {
    const data = await this.monitoringService.getThirdPartyStatus(timeframe);
    return new BaseResponse(true, 'Lấy trạng thái đối tác thành công', data);
  }

  // US1 - AC2: Đèn trạng thái tổng quan
  @Get('status-widget')
  @RequirePermissions(Resource.SYSTEM_MONITORING, Action.READ)
  async getSystemStatusWidget(@Query('timeframe') timeframe?: string) {
    const data = await this.monitoringService.getSystemStatusWidget(timeframe);
    return new BaseResponse(true, 'Lấy trạng thái hệ thống thành công', data);
  }

  // US1-AC6 & US2-AC6: Lịch sử hiệu năng vẽ biểu đồ
  @Get('performance-history-24h')
  @RequirePermissions(Resource.SYSTEM_MONITORING, Action.READ)
  async getPerformanceHistory(@Query('timeframe') timeframe?: string) {
    const data = await this.monitoringService.getPerformanceHistory(timeframe);
    return new BaseResponse(true, 'Lấy lịch sử hiệu năng thành công', data);
  }

  // US3 - AC6: Lịch sử lỗi giao dịch thanh toán
  @Get('payment-errors')
  @RequirePermissions(Resource.SYSTEM_MONITORING, Action.READ)
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

  // Gauge overview
  @Get('resources-current')
  @RequirePermissions(Resource.SYSTEM_MONITORING, Action.READ)
  async getCurrentResources(@Query('timeframe') timeframe?: string) {
    const data = await this.monitoringService.getCurrentResources(timeframe);
    return new BaseResponse(true, 'Lấy tài nguyên hiện tại thành công', data);
  }

  // Biểu đồ LineChart CPU/RAM
  @Get('resources-history-24h')
  @RequirePermissions(Resource.SYSTEM_MONITORING, Action.READ)
  async getResourceHistory(@Query('timeframe') timeframe?: string) {
    const data = await this.monitoringService.getResourceHistory(timeframe);
    return new BaseResponse(true, 'Lấy lịch sử tài nguyên thành công', data);
  }

  // US4 - Log bảo mật đã gom nhóm số lần vi phạm
  @Get('security-logs-recent')
  @RequirePermissions(Resource.SYSTEM_MONITORING, Action.READ)
  async getSecurityLogsRecent(@Query('timeframe') timeframe?: string) {
    const data =
      await this.monitoringService.getAggregatedSecurityLogs(timeframe);
    return new BaseResponse(true, 'Lấy log bảo mật thành công', data);
  }

  // Sự cố hệ thống & bảo mật gần đây
  @Get('incidents')
  @RequirePermissions(Resource.SYSTEM_MONITORING, Action.READ)
  async getIncidents(@Query('timeframe') timeframe?: string) {
    const data = await this.monitoringService.getRecentIncidents(timeframe);
    return new BaseResponse(true, 'Lấy danh sách sự cố thành công', data);
  }

  // Ngưỡng cảnh báo CPU/RAM/Disk
  @Get('thresholds')
  @RequirePermissions(Resource.SYSTEM_MONITORING, Action.READ)
  async getThresholds() {
    const data = await this.monitoringService.getThresholds();
    return new BaseResponse(true, 'Lấy ngưỡng cảnh báo thành công', data);
  }

  @Put('thresholds')
  @RequirePermissions(Resource.SYSTEM_MONITORING, Action.UPDATE)
  async updateThresholds(
    @Body() dto: UpdateThresholdsDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    const data = await this.monitoringService.updateThresholds(
      dto,
      user._id,
      ip,
      userAgent,
    );
    return new BaseResponse(true, 'Cập nhật ngưỡng cảnh báo thành công', data);
  }
}
