import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrackEventDto, MergeSessionDto } from './dto/track-event.dto';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import { ConfigService } from '@nestjs/config';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('tracking')
export class TrackingController {
  constructor(
    private readonly trackingService: TrackingService,
    private readonly configService: ConfigService,
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
}
