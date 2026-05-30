import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { VoucherRecommendationService } from '../promotions/voucher-recommendation.service';
import { NewArrivalsService } from 'src/modules/recommendations/engine/new-arrivals.service';
import { PersonalizedMarketingService } from './personalized-marketing.service';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import {
  GetContextualVouchersDto,
  GetDynamicBannersDto,
} from './dto/personalization.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Request } from 'express';

// Interface an toàn cho Request
interface RequestWithOptionalUser extends Request {
  user?: {
    _id?: string; // Cho phép optional
    id?: string; // Thêm id (do Passport JWT thường map 'sub' sang 'id')
    sub?: string; // Thêm sub (phòng hờ JwtStrategy trả thẳng payload)
    email: string;
    roles: string[];
  };
}

@Controller('personalization')
@UseGuards(JwtAuthGuard)
export class PersonalizationController {
  constructor(
    private readonly voucherRecService: VoucherRecommendationService,
    private readonly newArrivalsService: NewArrivalsService,
    private readonly personalizedMarketingService: PersonalizedMarketingService,
  ) {}

  // API: Lấy danh sách Voucher gợi ý (Có tiến trình Upsell giỏ hàng)

  @Public()
  @Get('vouchers')
  async getRecommendedVouchers(
    @Req() req: RequestWithOptionalUser,
    @Query() dto: GetContextualVouchersDto,
  ) {
    const userId = req.user?._id;
    const cartContext =
      dto.cart_total !== undefined
        ? {
            total_value: dto.cart_total,
            category_ids: [],
            delivery_province_id: dto.delivery_province_id,
          }
        : undefined;

    const data = await this.voucherRecService.getRecommendedVouchers(
      userId,
      dto.context,
      cartContext,
      dto.product_id,
    );

    return new BaseResponse(
      true,
      'Lấy danh sách Voucher cá nhân hóa thành công',
      data,
    );
  }

  //@Public()
  @Get('new-arrivals')
  async getNewArrivals(@Req() req: RequestWithOptionalUser) {
    const userId = req.user?._id || req.user?.id || req.user?.sub;
    const data =
      await this.newArrivalsService.getPersonalizedNewArrivals(userId);

    return new BaseResponse(
      true,
      'Lấy danh sách Sản phẩm mới thành công',
      data,
    );
  }

  // API: Lấy Banner Trang chủ (Dynamic Banner & A/B Testing)

  //@Public()
  @Get('home-banners')
  async getHomeBanners(
    @Req() req: RequestWithOptionalUser,
    @Query() dto: GetDynamicBannersDto,
  ) {
    const userId = req.user?._id;
    const data =
      await this.personalizedMarketingService.getDynamicHomepageBanners(
        userId,
        dto.session_id,
      );

    return new BaseResponse(
      true,
      'Lấy danh sách Banner cá nhân hóa thành công',
      data,
    );
  }

  // BỔ SUNG US3 - AC3: CHECK GIỎ HÀNG BỎ QUÊN (Để hiển thị Web Popup)

  @Public()
  @Get('abandoned-cart-popup')
  async checkAbandonedCart(@Req() req: RequestWithOptionalUser) {
    if (!req.user?._id)
      return new BaseResponse(true, 'Khách vãng lai', {
        has_abandoned_cart: false,
      });

    const data =
      await this.personalizedMarketingService.checkAbandonedCartPopup(
        req.user._id,
      );
    return new BaseResponse(true, 'Thành công', data);
  }

  // BỔ SUNG US2 - AC10: GHI NHẬN NÚT "X" (Dismiss Recommendation)

  @Public()
  @Post('new-arrivals/dismiss')
  async dismissNewArrival(
    @Req() req: RequestWithOptionalUser,
    @Query('product_id') productId: string,
    @Query('session_id') sessionId: string,
  ) {
    if (!productId) return new BaseResponse(false, 'Thiếu product_id');

    // Nếu khách đã đăng nhập dùng User ID, nếu chưa dùng Session ID làm fallback
    const identifier = req.user?._id || sessionId;
    await this.newArrivalsService.dismissRecommendation(
      identifier,
      productId,
      sessionId,
    );

    return new BaseResponse(
      true,
      'Đã ghi nhận, sẽ giảm hiển thị sản phẩm này trong tương lai',
    );
  }

  @Public()
  @Post('trigger-winback')
  async triggerWinBack() {
    await this.personalizedMarketingService.executeWinBackCampaign();
    return { message: 'Triggered Winback Cron' };
  }
}
