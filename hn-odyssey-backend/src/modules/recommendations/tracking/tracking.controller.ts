import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
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
  CouponFilterDto,
  LoyaltyFilterDto,
  TrackingFilterDto,
} from './dto/marketing-tracking.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { TrackingSeederService } from './tracking-seeder.service';

@Controller('tracking')
export class TrackingController {
  constructor(
    private readonly trackingService: TrackingService,
    private readonly configService: ConfigService,
    private readonly trackingSeederService: TrackingSeederService,
  ) {}

  // AC1, AC2, AC3: Nhận tín hiệu Tracking từ FE
  @Public()
  @Post('event')
  @HttpCode(HttpStatus.ACCEPTED) // Status 202: Nhận yêu cầu và xử lý ngầm (Non-blocking)
  trackEvent(@Body() trackEventDto: TrackEventDto) {
    this.trackingService.logEvent(trackEventDto);
    // Trả về ngay lập tức để không làm chậm thao tác người dùng
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
  @RequirePermissions(Resource.REPORTS, Action.READ)
  async getCampaignsReport(@Query() filter: TrackingFilterDto) {
    const data = await this.trackingService.getCampaignPerformance(filter);
    return new BaseResponse(true, 'Lấy báo cáo chiến dịch thành công', data);
  }

  @Get('coupons')
  @RequirePermissions(Resource.PROMOTIONS, Action.READ)
  async getCouponsReport(@Query() filter: CouponFilterDto) {
    const data = await this.trackingService.getCouponPerformance(filter);
    return new BaseResponse(true, 'Lấy báo cáo mã giảm giá thành công', data);
  }

  @Get('loyalty-health')
  @RequirePermissions(Resource.LOYALTY, Action.READ)
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
  @RequirePermissions(Resource.REPORTS, Action.EXPORT)
  async exportCampaignsExcel(
    @Query() filter: TrackingFilterDto,
    @Res() res: Response,
    @CurrentUser() user: UserExportInfo, // Lấy thông tin user hiện tại
  ) {
    try {
      // Truyền thêm object user vào service
      const workbook = await this.trackingService.generateCampaignsExcel(
        filter,
        user,
      );

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Bao_Cao_Marketing_H&N_Odyssey_${Date.now()}.xlsx`,
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      throw new InternalServerErrorException(
        'Đã xảy ra lỗi khi xuất file báo cáo chuyên sâu.',
        { cause: error },
      );
    }
  }

  // US4 - AC1: Cập nhật chi phí quảng cáo (Ad Spend)
  @Patch('campaigns/:id/ad-spend')
  // Dành cho Sales & Marketing
  @RequirePermissions(Resource.REPORTS, Action.UPDATE)
  async updateAdSpend(
    @Param('id') id: string,
    @Body('ad_spend') adSpend: number,
  ) {
    if (typeof adSpend !== 'number' || adSpend < 0) {
      return new BaseResponse(false, 'Chi phí quảng cáo không hợp lệ');
    }
    await this.trackingService.updateAdSpend(id, adSpend);
    return new BaseResponse(true, 'Cập nhật chi phí quảng cáo thành công');
  }

  // US1 - AC8 & US4 - AC5: Biểu đồ xu hướng chiến dịch
  @Get('campaigns/:id/trend')
  @RequirePermissions(Resource.REPORTS, Action.READ)
  async getCampaignTrend(
    @Param('id') id: string,
    @Query() filter: TrackingFilterDto,
  ) {
    const data = await this.trackingService.getCampaignTrend(id, filter);
    return new BaseResponse(true, 'Lấy dữ liệu biểu đồ thành công', data);
  }

  // US2 - AC2: Tra cứu chi tiết đơn hàng theo mã giảm giá
  @Get('coupons/:code/orders')
  @RequirePermissions(Resource.PROMOTIONS, Action.READ)
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
