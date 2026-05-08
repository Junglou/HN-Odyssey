import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  Delete,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
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
import { CollaborativeFilteringService } from './engine/collaborative-filtering.service';
import { ViewBasedService } from './engine/view-based.service';
import { PurchaseBasedService } from './engine/purchase-based.service';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { AuditLogsService } from '../system/audit-logs/audit-logs.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';

export class SubmitFeedbackDto implements IRecommendationFeedback {
  session_id: string;
  user_id?: string;
  recommended_product_id: string;
  widget_type: 'FBT' | 'CART' | 'HOME' | 'CATEGORY';
  action: 'CLICK' | 'VIEW' | 'IGNORE' | 'ADD_TO_CART';
}

// Đồng nhất interface với JWT Payload thực tế
interface RequestWithUser extends Request {
  user: {
    _id: string;
    email: string;
    roles: string[];
  };
}

@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly fbtService: AssociationRuleService,
    private readonly cartRecService: ContextualCartService,
    private readonly personalizedService: PersonalizedService,
    private readonly bundleService: BundleDiscountService,
    private readonly trackingService: TrackingService,
    private readonly viewBasedService: ViewBasedService,
    private readonly purchaseBasedService: PurchaseBasedService,
    private readonly cfService: CollaborativeFilteringService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60 } })
  @Get('fbt')
  async getFBT(@Query() dto: GetFBTDto): Promise<IFBTRecommendation[]> {
    return this.fbtService.getFrequentlyBoughtTogether(
      dto.product_id,
      dto.limit || 3,
    );
  }

  @Public()
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

  @Public()
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

  @Public()
  @Get('personalized/related')
  async getRelatedProducts(
    @Query('product_id') productId: string,
  ): Promise<IRecommendationResult> {
    return this.personalizedService.getRelatedProducts(productId, 10);
  }

  @Public()
  @Get('personalized/similar')
  async getLookingSimilar(
    @Query('product_id') productId: string,
  ): Promise<IRecommendationResult> {
    return this.personalizedService.getLookingSimilar(productId, 10);
  }

  @Public()
  @Post('bundle/add-to-cart')
  async addBundleToCart(
    @Req() req: RequestWithUser,
    @Body() dto: AddBundleToCartDto,
  ): Promise<{ message: string; total_discount: number; items_added: number }> {
    const userId = req.user?._id;
    return this.bundleService.applyComboDiscountAndAddToCart(dto, userId);
  }

  @Public()
  @Post('feedback')
  async submitFeedback(
    @Body() dto: SubmitFeedbackDto,
  ): Promise<{ success: boolean; message: string }> {
    this.trackingService.logEvent({
      session_id: dto.session_id,
      user_id: dto.user_id,
      action:
        dto.action === 'CLICK'
          ? BehaviorAction.VIEW_PRODUCT
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

  @Public()
  @Get('recently-viewed')
  async getRecentlyViewed(
    @Query('session_id') sessionId: string,
    @Query('current_product_id') currentProductId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.viewBasedService.getRecentlyViewed(
      sessionId,
      req.user?._id,
      12,
      currentProductId,
    );
  }

  // Bắt buộc đăng nhập để xem lịch sử mua lại
  @UseGuards(JwtAuthGuard)
  @Get('reorder')
  async getReorder(@Req() req: RequestWithUser) {
    const userId = req.user?._id;

    if (!userId) {
      return [];
    }
    return this.purchaseBasedService.getReorderAndAccessories(userId);
  }

  @Public()
  @Get('discover')
  async getDiscoverCF(
    @Req() req: RequestWithUser,
    @Query('user_id') queryUserId?: string,
  ) {
    const userId = req.user?._id || queryUserId;

    if (!userId) {
      const fallback = await this.personalizedService.getTrendingItems(10);
      return {
        test_group: 'ALGO_TRENDING',
        data: fallback.products as unknown as ProductDocument[],
      };
    }

    const userIdStr = String(userId);
    const lastChar = userIdStr.slice(-1);
    const isGroupA = parseInt(lastChar, 16) % 2 === 0;

    let products: ProductDocument[];
    let testGroup: 'ALGO_SVD' | 'ALGO_TRENDING';

    if (isGroupA) {
      products =
        await this.cfService.getCollaborativeRecommendations(userIdStr);
      testGroup = 'ALGO_SVD';
    } else {
      const fallback = await this.personalizedService.getTrendingItems(10);
      products = fallback.products as unknown as ProductDocument[];
      testGroup = 'ALGO_TRENDING';
    }

    return {
      test_group: testGroup,
      data: products,
    };
  }

  @Public()
  @Delete('recently-viewed')
  async clearRecentlyViewed(
    @Query('session_id') sessionId: string,
    @Req() req: RequestWithUser,
  ) {
    const success = await this.viewBasedService.clearViewHistory(
      sessionId,
      req.user?._id,
    );
    return { success, message: 'Đã xóa lịch sử xem sản phẩm' };
  }

  @Public()
  @Post('impression')
  async recordImpression(
    @Body()
    dto: {
      session_id: string;
      user_id?: string;
      product_ids: string[];
    },
  ) {
    await this.trackingService.logImpressions(
      dto.user_id || dto.session_id,
      dto.product_ids,
    );
    return { success: true };
  }

  // API dành riêng cho Admin báo cáo
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.REPORTS, Action.READ)
  @Get('admin/replenishment-list')
  async getAdminReplenishment(@Req() req: RequestWithUser) {
    try {
      const data = await this.purchaseBasedService.getReplenishmentCandidates();

      await this.auditLogsService.log({
        action: 'EXPORT_REPLENISHMENT_LIST',
        collection_name: Resource.REPORTS,
        actor_id: req.user?._id,
        actor_email: req.user?.email,
        department: 'ACCOUNTING',
        detail: {
          total_candidates: data.length,
          purpose:
            'Lấy danh sách khách hàng tiềm năng để gửi Email nhắc mua lại',
        },
        is_success: true,
        ip: req.ip,
        user_agent: req.headers['user-agent'] as string,
      });

      return data;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await this.auditLogsService.log({
        action: 'EXPORT_REPLENISHMENT_LIST',
        collection_name: Resource.REPORTS,
        actor_id: req.user?._id,
        is_success: false,
        error_reason: errorMessage,
        department: 'ACCOUNTING',
      });
      throw error;
    }
  }
}
