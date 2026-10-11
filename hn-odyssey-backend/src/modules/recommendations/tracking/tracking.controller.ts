import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Res,
  Patch,
  Param,
  Query,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Response } from 'express';
import { TrackingService } from './tracking.service';
import type { UserExportInfo } from './tracking.service';
import { TrackEventDto, MergeSessionDto } from './dto/track-event.dto';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import { ConfigService } from '@nestjs/config';
import { Public } from 'src/common/decorators/public.decorator';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Resource, Action } from 'src/common/enums/resource.enum';
import {
  AdSpendEntryQueryDto,
  CouponFilterDto,
  CreateAdSpendEntryDto,
  LoyaltyFilterDto,
  TrackingFilterDto,
  VoidAdSpendEntryDto,
} from './dto/marketing-tracking.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { TrackingSeederService } from './tracking-seeder.service';

@Controller('tracking')
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);
  constructor(
    private readonly trackingService: TrackingService,
    private readonly configService: ConfigService,
    private readonly trackingSeederService: TrackingSeederService,
  ) {}

  // AC1, AC2, AC3: Nhận tín hiệu Tracking từ FE
  @Public()
  @Post('event')
  @HttpCode(HttpStatus.ACCEPTED)
  trackEvent(@Body() trackEventDto: TrackEventDto) {
    // Kích hoạt hàm bất đồng bộ nhưng KHÔNG DÙNG await để trả về response ngay cho FE
    this.trackingService.logEvent(trackEventDto).catch((err) => {
      // Bắt lỗi ở tầng cao nhất nếu promise bị reject
      console.error('Lỗi ở TrackEvent Controller:', err);
    });

    return { success: true };
  }

  // AC5: Gọi API này ngay khi user Login thành công
  @Post('merge')
  @HttpCode(HttpStatus.OK)
  async mergeSession(@Body() mergeDto: MergeSessionDto) {
    await this.trackingService.mergeGuestToMember(mergeDto);
    return new BaseResponse(true, 'Hợp nhất dữ liệu Session thành công');
  }

  // CUNG CẤP CẤU HÌNH TRACKING CHO FRONTEND (US Heatmap AC1, AC5, AC6 & US GA4 AC1, AC5)
  @Public()
  @Get('scripts-config')
  getTrackingScripts() {
    // 3. Lấy giá trị thật từ ConfigService
    const gaId = this.configService.get<string>('GA_MEASUREMENT_ID');
    const clarityId = this.configService.get<string>('CLARITY_PROJECT_ID');

    return new BaseResponse(true, 'Lấy cấu hình tracking thành công', {
      google_analytics: {
        enabled: !!gaId, // Tự động bật nếu có ID
        measurement_id: gaId || 'G-XXXXXXXXXX',
        require_cookie_consent: true,
      },
      heatmap: {
        enabled: !!clarityId, // AC6: Toggle switch tự động
        provider: 'Microsoft Clarity',
        project_id: clarityId || 'clr_xxxxxxxxxx',
        privacy_masking: true, // AC5: Bảo mật thông tin nhạy cảm
      },
    });
  }

  @Post('capture-guest-email')
  async captureGuestEmail(@Body() body: { session_id: string; email: string }) {
    await this.trackingService.captureGuestEmail(body.session_id, body.email);
    return { success: true };
  }

  @Get('campaigns')
  @RequirePermissions(
    [Resource.REPORT_MARKETING, Resource.REPORT_INVENTORY],
    Action.READ,
  )
  async getCampaignsReport(@Query() filter: TrackingFilterDto) {
    const data = await this.trackingService.getCampaignPerformance(filter);
    return new BaseResponse(true, 'Lấy báo cáo chiến dịch thành công', data);
  }

  @Get('coupons')
  @RequirePermissions(Resource.REPORT_MARKETING, Action.READ)
  async getCouponsReport(@Query() filter: CouponFilterDto) {
    const data = await this.trackingService.getCouponPerformance(filter);
    return new BaseResponse(true, 'Lấy báo cáo mã giảm giá thành công', data);
  }

  @Get('loyalty-health')
  @RequirePermissions(Resource.REPORT_MARKETING, Action.READ)
  async getLoyaltyHealthReport(@Query() filter: LoyaltyFilterDto) {
    const data = await this.trackingService.getLoyaltyHealth(filter);
    return new BaseResponse(
      true,
      'Lấy báo cáo sức khỏe Loyalty thành công',
      data,
    );
  }

  // AC6 - Export Campaign Report
  @Get('campaigns/export')
  @RequirePermissions(Resource.REPORT_MARKETING, Action.EXPORT)
  async exportCampaignsExcel(
    @Query() filter: TrackingFilterDto,
    @Res() res: Response,
    @CurrentUser() user: UserExportInfo,
  ): Promise<void> {
    let buffer: Buffer;
    try {
      const workbook = await this.trackingService.generateCampaignsExcel(
        filter,
        user,
      );
      buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Xuất Excel Marketing thất bại: ${msg}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        `Lỗi khi xuất file báo cáo Marketing: ${msg}`,
      );
    }

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Bao_Cao_Marketing_${Date.now()}.xlsx"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    });
    res.end(buffer);
  }

  // US.82 AC1 — Ad Spend Ledger: xem nhật ký (READ xem được, không thêm/hủy được)
  @Get('campaigns/:id/ad-spend')
  @RequirePermissions(Resource.REPORT_MARKETING, Action.READ)
  async getAdSpendEntries(
    @Param('id') id: string,
    @Query() query: AdSpendEntryQueryDto,
  ) {
    const data = await this.trackingService.getAdSpendEntries(id, query);
    return new BaseResponse(
      true,
      'Lấy nhật ký chi phí quảng cáo thành công',
      data,
    );
  }

  // US.82 AC1 — thêm 1 dòng chi phí
  @Post('campaigns/:id/ad-spend')
  @RequirePermissions(Resource.REPORT_MARKETING, Action.UPDATE)
  async addAdSpendEntry(
    @Param('id') id: string,
    @Body() dto: CreateAdSpendEntryDto,
    @CurrentUser('_id') userId: string,
  ) {
    const data = await this.trackingService.addAdSpendEntry(id, dto, userId);
    return new BaseResponse(true, 'Đã ghi nhận chi phí quảng cáo', data);
  }

  // US.82 AC1 — hủy 1 dòng chi phí (bắt buộc lý do)
  @Patch('campaigns/:id/ad-spend/:entryId/void')
  @RequirePermissions(Resource.REPORT_MARKETING, Action.UPDATE)
  async voidAdSpendEntry(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body() dto: VoidAdSpendEntryDto,
    @CurrentUser('_id') userId: string,
  ) {
    const data = await this.trackingService.voidAdSpendEntry(
      id,
      entryId,
      dto.reason,
      userId,
    );
    return new BaseResponse(true, 'Đã hủy dòng chi phí', data);
  }

  // US1 - AC8 & US4 - AC5: Biểu đồ xu hướng chiến dịch
  @Get('campaigns/:id/trend')
  @RequirePermissions(Resource.REPORT_MARKETING, Action.READ)
  async getCampaignTrend(
    @Param('id') id: string,
    @Query() filter: TrackingFilterDto,
  ) {
    const data = await this.trackingService.getCampaignTrend(id, filter);
    return new BaseResponse(true, 'Lấy dữ liệu biểu đồ thành công', data);
  }

  // US2 - AC2: Tra cứu chi tiết đơn hàng theo mã giảm giá
  @Get('coupons/:code/orders')
  @RequirePermissions(Resource.REPORT_MARKETING, Action.READ)
  async getCouponOrders(
    @Param('code') code: string,
    @Query() filter: CouponFilterDto,
  ) {
    const data = await this.trackingService.getOrdersByCoupon(code, filter);
    return new BaseResponse(
      true,
      'Lấy danh sách đơn hàng dùng mã thành công',
      data,
    );
  }

  @Public()
  @Post('seed-marketing-data')
  async seedMarketingData() {
    return await this.trackingSeederService.seedMarketingData();
  }
}
