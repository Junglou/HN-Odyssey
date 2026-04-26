import { Controller, Get, Post, Query, Body, Req } from '@nestjs/common';
import type { Request } from 'express'; // Import type Request từ express
import { AssociationRuleService } from './engine/association-rule.service';
import { ContextualCartService } from './engine/contextual-cart.service';
import { PersonalizedService } from './engine/personalized.service';
import { BundleDiscountService } from './engine/bundle-discount.service';
import {
  GetFBTDto,
  GetCartRecommendationsDto,
  GetPersonalizedDto,
} from './dto/recommendation.dto';
import { AddBundleToCartDto } from './dto/bundle-cart.dto';
import { TrackingService } from './tracking/tracking.service';

// Import các Interface chuẩn để ESLint không báo lỗi no-unsafe-return
import type {
  IFBTRecommendation,
  IRecommendationFeedback,
} from 'src/common/interfaces/recommendation.interface';
import type { IRecommendationResult } from 'src/common/interfaces/algolia.interface';
import { ProductDocument } from 'src/modules/products/catalog/schemas/product.schema';

import {
  BehaviorAction,
  DeviceType,
} from './tracking/schemas/user-behavior.schema';
import { Public } from 'src/common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';

export class SubmitFeedbackDto implements IRecommendationFeedback {
  session_id: string;
  user_id?: string;
  recommended_product_id: string;
  widget_type: 'FBT' | 'CART' | 'HOME' | 'CATEGORY';
  action: 'CLICK' | 'VIEW' | 'IGNORE' | 'ADD_TO_CART';
}

// Định nghĩa interface mở rộng an toàn cho Request để Typescript không báo lỗi "any"
interface RequestWithUser extends Request {
  user?: {
    id?: string;
  };
}

@Public()
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly fbtService: AssociationRuleService,
    private readonly cartRecService: ContextualCartService,
    private readonly personalizedService: PersonalizedService,
    private readonly bundleService: BundleDiscountService,
    private readonly trackingService: TrackingService,
  ) {}

  @Throttle({ default: { limit: 20, ttl: 60 } }) // Tối đa 20 requests / 60 giây cho mỗi IP
  @Get('fbt')
  async getFBT(@Query() dto: GetFBTDto): Promise<IFBTRecommendation[]> {
    return this.fbtService.getFrequentlyBoughtTogether(
      dto.product_id,
      dto.limit || 3,
    );
  }

  @Get('cart')
  async getCartRecs(
    @Query() dto: GetCartRecommendationsDto,
  ): Promise<ProductDocument[]> {
    return this.cartRecService.getCartRecommendations(
      dto.session_id,
      dto.user_id,
      Number(dto.current_cart_total),
    );
  }

  @Get('personalized')
  async getPersonalized(
    @Query() dto: GetPersonalizedDto,
  ): Promise<IRecommendationResult> {
    if (dto.current_category_slug) {
      return this.personalizedService.getTrendingItems(
        10,
        'categories',
        dto.current_category_slug,
      );
    }

    return this.personalizedService.getJustForYouWidget(
      dto.session_id,
      dto.user_id,
      10,
    );
  }

  @Get('personalized/related')
  async getRelatedProducts(
    @Query('product_id') productId: string,
  ): Promise<IRecommendationResult> {
    return this.personalizedService.getRelatedProducts(productId, 10);
  }

  @Get('personalized/similar')
  async getLookingSimilar(
    @Query('product_id') productId: string,
  ): Promise<IRecommendationResult> {
    return this.personalizedService.getLookingSimilar(productId, 10);
  }

  @Post('bundle/add-to-cart')
  async addBundleToCart(
    @Req() req: RequestWithUser, // Inject đối tượng Request có chứa kiểu user an toàn
    @Body() dto: AddBundleToCartDto,
  ): Promise<{ message: string; total_discount: number; items_added: number }> {
    // Lấy userId an toàn, đã bỏ `dto.user_id` để tránh lỗi TS
    const userId = req.user?.id || undefined;
    return this.bundleService.applyComboDiscountAndAddToCart(dto, userId);
  }

  @Post('feedback')
  async submitFeedback(
    @Body() dto: SubmitFeedbackDto,
  ): Promise<{ success: boolean; message: string }> {
    this.trackingService.logEvent({
      session_id: dto.session_id,
      user_id: dto.user_id,
      action:
        dto.action === 'CLICK'
          ? BehaviorAction.CLICK_SEARCH_SUGGESTION
          : BehaviorAction.VIEW_PAGE,
      path: `/widget/${dto.widget_type}`,
      device: DeviceType.DESKTOP,
      metadata: {
        product_id: dto.recommended_product_id,
        suggestion_type: 'PRODUCT',
      },
    });

    const algoliaUserToken = dto.user_id || dto.session_id;

    await this.trackingService.sendAlgoliaInsight(
      dto.action === 'CLICK' ? 'CLICK' : 'VIEW',
      algoliaUserToken,
      dto.recommended_product_id,
      dto.widget_type,
    );

    return {
      success: true,
      message: 'Đã ghi nhận tương tác để huấn luyện Model',
    };
  }
}
