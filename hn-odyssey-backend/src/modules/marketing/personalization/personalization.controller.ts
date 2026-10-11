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

// Chuẩn hóa Interface
interface RequestWithOptionalUser extends Request {
  user?: {
    _id: string; // Chỉ lấy _id như cấu trúc của JwtStrategy trả về
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

  @Public()
  @Get('vouchers')
  async getRecommendedVouchers(
    @Req() req: RequestWithOptionalUser,
    @Query() dto: GetContextualVouchersDto,
  ) {
    const userId = req.user?._id; // Gọn gàng hơn
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

  @Get('new-arrivals')
  async getNewArrivals(@Req() req: RequestWithOptionalUser) {
    const userId = req.user?._id; // Gọn gàng hơn
    const data =
      await this.newArrivalsService.getPersonalizedNewArrivals(userId);

    return new BaseResponse(
      true,
      'Lấy danh sách Sản phẩm mới thành công',
      data,
    );
  }

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

  @Public()
  @Post('new-arrivals/dismiss')
  async dismissNewArrival(
    @Req() req: RequestWithOptionalUser,
    @Query('product_id') productId: string,
    @Query('session_id') sessionId: string,
  ) {
    if (!productId) return new BaseResponse(false, 'Thiếu product_id');

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
