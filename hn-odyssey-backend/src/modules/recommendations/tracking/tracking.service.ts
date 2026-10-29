import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  formatVnDate,
  parseVnDate,
  toVnDayRange,
  toVnParts,
  vnStartOfDay,
} from 'src/common/utils/date-range.util';
import { NON_REVENUE_ORDER_STATUSES } from 'src/common/constants/order-status.constant';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  UserBehavior,
  BehaviorAction,
  DeviceType,
} from './schemas/user-behavior.schema';
import { TrackEventDto, MergeSessionDto } from './dto/track-event.dto';
import { Cart } from 'src/modules/sales/cart/schemas/cart.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import {
  AdCampaign,
  AdCampaignDocument,
} from 'src/modules/marketing/campaigns/schemas/ad-campaign.schema';
import {
  Coupon,
  CouponDocument,
} from 'src/modules/marketing/promotions/schemas/coupon.schema';
import { CustomerDocument } from 'src/modules/users/customers/schemas/customer.schema';
import { Customer } from 'src/modules/users/customers/schemas/customer.schema';
import {
  LoyaltyHistory,
  LoyaltyHistoryDocument,
} from 'src/modules/marketing/loyalty/schemas/loyalty-history.schema';
import {
  AdSpendEntryQueryDto,
  CouponFilterDto,
  CreateAdSpendEntryDto,
  LoyaltyFilterDto,
  TrackingFilterDto,
} from './dto/marketing-tracking.dto';
import {
  IAdSpendActor,
  IAdSpendEntryList,
  IAdSpendEntryView,
  IAdSpendMutationResult,
  ICampaignReport,
  ICampaignTrend,
  ICouponOrderDetail,
  ICouponReport,
  ILoyaltyHealthReport,
  ProfitStatus,
} from 'src/common/interfaces/marketing-tracking.interface';
import * as ExcelJS from 'exceljs';
import {
  IAlgoliaInsightEvent,
  IAlgoliaInsightPayload,
} from 'src/common/interfaces/algolia.interface';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { DEFAULT_TIER_CODE } from 'src/common/constants/loyalty.constant';
import {
  AdSpendEntry,
  AdSpendEntryDocument,
} from 'src/modules/marketing/campaigns/schemas/ad-spend-entry.schema';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import {
  AllocatableSpendEntry,
  allocateSpendByDay,
  allocateSpendInRange,
  roundMoney,
  toCents,
  toVnDayIndex,
  vnDayKey,
} from 'src/common/utils/ad-spend-allocation.util';
import { Department } from 'src/common/enums/department.enum';

export interface UserExportInfo {
  fullName?: string;
  lastName?: string;
  firstName?: string;
  email?: string;
}

interface NodeSystemError extends Error {
  code?: string;
  syscall?: string;
  hostname?: string;
}

// Người nhập/hủy chi phí sau khi populate (field theo schema User)
interface PopulatedActor {
  _id: Types.ObjectId;
  email?: string;
  fullName?: string;
  first_Name?: string;
  last_Name?: string;
}

interface AdSpendEntryRow {
  _id: Types.ObjectId;
  campaign_id: Types.ObjectId;
  amount: number;
  period_start: Date;
  period_end: Date;
  note?: string;
  created_by: PopulatedActor | null;
  is_voided: boolean;
  voided_by: PopulatedActor | null;
  voided_at: Date | null;
  void_reason: string | null;
  createdAt: Date;
}

type VnDayRange = { start: Date; end: Date };

const ACTOR_FIELDS = 'email fullName first_Name last_Name';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private readonly EXCLUDED_STATUSES = NON_REVENUE_ORDER_STATUSES;
  private readonly insightsApiUrl = 'https://insights.algolia.io/1/events';
  private readonly indexName: string;
  private readonly headers: Record<string, string>;

  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
    @InjectModel(AdCampaign.name)
    private campaignModel: Model<AdCampaignDocument>,
    @InjectModel(UserBehavior.name) private behaviorModel: Model<UserBehavior>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(LoyaltyHistory.name)
    private loyaltyModel: Model<LoyaltyHistoryDocument>,
    @InjectModel(AdSpendEntry.name)
    private adSpendModel: Model<AdSpendEntryDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.indexName =
      this.configService.get<string>('ALGOLIA_INDEX_NAME') || 'products';

    this.headers = {
      'X-Algolia-Application-Id':
        this.configService.get<string>('ALGOLIA_APP_ID') || '',
      'X-Algolia-API-Key':
        this.configService.get<string>('ALGOLIA_ADMIN_KEY') || '',
      'Content-Type': 'application/json',
    };
  }

  // Khoảng ngày theo giờ VN, dùng chung cho mọi báo cáo Marketing
  private buildDateMatch(filter: {
    start_date?: string;
    end_date?: string;
  }): Record<string, unknown> {
    if (!filter.start_date || !filter.end_date) return {};
    const range = toVnDayRange(filter.start_date, filter.end_date);
    return range ? { createdAt: { $gte: range.start, $lte: range.end } } : {};
  }

  // US2 - AC5: Thu thập Email khách vãng lai
  async captureGuestEmail(session_id: string, email: string): Promise<void> {
    try {
      await this.behaviorModel.updateMany(
        { session_id: session_id },
        { $set: { 'metadata.guest_email': email } },
      );
      this.logger.log(`Captured guest email for session: ${session_id}`);
    } catch (error) {
      this.logger.error(
        `Failed to capture guest email: ${(error as Error).message}`,
      );
    }
  }

  // AC6: HIỆU NĂNG GHI LOG - Request xử lý Không đồng bộ (Fail-silently)
  async logEvent(dto: TrackEventDto): Promise<void> {
    try {
      const is_bounce = (dto.dwell_time_seconds ?? 0) < 3;

      let validUserId: Types.ObjectId | undefined = undefined;
      if (dto.user_id && Types.ObjectId.isValid(dto.user_id)) {
        validUserId = new Types.ObjectId(dto.user_id);
      }

      const behavior = new this.behaviorModel({
        ...dto,
        is_bounce,
        user_id: validUserId,
      });

      await behavior.save();

      const productId = dto.metadata?.product_id;
      const queryId = dto.metadata?.query_id; // FIX 3: Trích xuất query_id từ request
      const position = dto.metadata?.position;

      const userToken = validUserId ? validUserId.toString() : dto.session_id;

      if (productId) {
        switch (dto.action) {
          case BehaviorAction.VIEW_PRODUCT:
            void this.sendAlgoliaInsight(
              'VIEW',
              userToken,
              productId,
              'Product_Detail',
              queryId,
              position,
            );
            break;

          case BehaviorAction.ADD_TO_CART:
          case BehaviorAction.CLICK_ADD_TO_CART:
            void this.sendAlgoliaInsight(
              'ADD_TO_CART',
              userToken,
              productId,
              'Cart',
              queryId,
              position,
            );
            break;

          case BehaviorAction.CLICK_SEARCH_SUGGESTION:
            void this.sendAlgoliaInsight(
              'CLICK',
              userToken,
              productId,
              'Recommendation_Widget',
              queryId,
              position,
            );
            break;

          // Bổ sung vào switch (dto.action)
          case BehaviorAction.VIEW_PAGE:
            if (dto.path === '/widget/recommendation') {
              void this.sendAlgoliaInsight(
                'VIEW',
                userToken,
                productId,
                'Recommendation_Widget',
                queryId,
              );
            }
            break;
        }
      }
    } catch (error) {
      this.logger.error(
        `Tracking processing error: ${(error as Error).message}`,
      );
    }
  }

  // AC5: HỢP NHẤT DỮ LIỆU - Map toàn bộ lịch sử SessionID của Guest sang UserID
  async mergeGuestToMember(dto: MergeSessionDto): Promise<void> {
    try {
      await this.behaviorModel
        .updateMany(
          { session_id: dto.session_id, user_id: { $exists: false } },
          { $set: { user_id: new Types.ObjectId(dto.user_id) } },
        )
        .exec();
      this.logger.log(
        `Merged session ${dto.session_id} to user ${dto.user_id}`,
      );
    } catch (error) {
      this.logger.error(`Merge session failed: ${(error as Error).message}`);
    }
  }

  // US2 - AC3, AC4, AC5: XÁC ĐỊNH & CHỤP ẢNH BỎ QUÊN GIỎ HÀNG (Abandonment Detection)
  @Cron(CronExpression.EVERY_30_MINUTES)
  async detectAbandonedCarts(): Promise<void> {
    this.logger.log('Bắt đầu quét các giỏ hàng bị bỏ quên...');

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000);

    const abandonedCarts = await this.cartModel
      .find({
        updatedAt: { $lte: thirtyMinutesAgo, $gte: twoHoursAgo },
        'items.0': { $exists: true },
      })
      .lean()
      .exec();

    for (const cart of abandonedCarts) {
      const lastBehavior = await this.behaviorModel
        .findOne({ session_id: cart.session_id })
        .sort({ createdAt: -1 })
        .exec();

      const snapshot = await this.behaviorModel.create({
        session_id: cart.session_id || 'SYSTEM_GENERATED',
        user_id: cart.user_id,
        action: BehaviorAction.EXIT_PAGE,
        path: '/cart',
        device: lastBehavior?.device || DeviceType.DESKTOP,
        metadata: {
          cart_snapshot: cart.items,
          source: lastBehavior?.source || 'Direct',
        },
      });

      this.eventEmitter.emit('tracking.cart.abandoned', {
        cart_id: cart._id,
        user_id: cart.user_id,
        session_id: cart.session_id,
        snapshot_id: snapshot._id,
      });
    }
  }

  @OnEvent(NOTIFY_EVENTS.ORDER_CREATED)
  async handleOrderCreatedTracking(order: Order) {
    try {
      // 1. Tự động lưu 1 record PURCHASE vào bảng tracking của bạn để BI Dashboard vẽ Phễu
      await this.behaviorModel.create({
        session_id: order.session_id || 'SYSTEM_GUEST',
        user_id: order.user_id,
        action: BehaviorAction.PURCHASE, // Ghi nhận Purchase!
        device: DeviceType.DESKTOP, // Mặc định hoặc lấy từ order nếu có
        path: '/checkout/success',
        source: 'System_Auto_Log',
        metadata: {
          order_code: order.order_code,
          total_amount: order.total_amount,
        },
      });
      this.logger.log(
        `Auto-logged PURCHASE event for order: ${order.order_code}`,
      );

      // 2. Gọi hàm bắn sang Google Analytics có sẵn của bạn
      await this.sendPurchaseEventToGA4(order, order.session_id);
    } catch (error) {
      this.logger.error(
        `Lỗi khi tự động log sự kiện Purchase: ${(error as Error).message}`,
      );
    }
  }

  // US5 - AC4: Gửi sự kiện mua hàng sang GA4 với thông tin thật
  async sendPurchaseEventToGA4(order: Order, clientId?: string) {
    const measurementId = this.configService.get<string>('GA_MEASUREMENT_ID');
    const apiSecret = this.configService.get<string>('GA_API_SECRET');

    if (!measurementId || !apiSecret) {
      this.logger.warn('GA4 Config is missing. Skipping event broadcast.');
      return;
    }

    try {
      await axios.post(
        `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
        {
          client_id: clientId || order.session_id || 'anonymous',
          events: [
            {
              name: 'purchase',
              params: {
                currency: 'VND',
                value: order.total_amount,
                transaction_id: order.order_code,
                items: order.items.map((item) => ({
                  item_id: item.sku,
                  item_name: item.product_name,
                  price: item.price,
                  quantity: item.quantity,
                })),
              },
            },
          ],
        },
      );
      this.logger.log(`GA4 Purchase Event Sent: ${order.order_code}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send GA4 event: ${errorMessage}`);
    }
  }

  // 1. TRACKING CHIẾN DỊCH QUẢNG CÁO & ROI (Last-click Attribution)
  async getCampaignPerformance(
    filter: TrackingFilterDto,
  ): Promise<ICampaignReport[]> {
    const dateMatch = this.buildDateMatch(filter);

    // [FIX 2] - Xử lý map bộ lọc UTM từ DTO
    const utmFilter: Record<string, unknown> = {};
    if (filter.utm_source) utmFilter['metadata.utm_source'] = filter.utm_source;
    if (filter.utm_medium) utmFilter['metadata.utm_medium'] = filter.utm_medium;

    const campaigns = await this.campaignModel.find().lean();
    const reports: ICampaignReport[] = [];

    // Ad Spend Ledger: 1 truy vấn lấy mọi dòng chi phí giao với kỳ lọc, phân bổ trên RAM (tránh N+1)
    const spendRange = this.buildSpendRange(filter);
    const spendEntriesByCampaign = await this.loadSpendEntries(
      campaigns.map((c) => String(c._id)),
      spendRange,
    );

    for (const campaign of campaigns) {
      // [FIX 3] - Thêm utmFilter vào $match và trích xuất utm_term, utm_content để làm Drill-down
      const sessionAgg = await this.behaviorModel.aggregate<{
        _id: string;
        terms: string[];
        contents: string[];
      }>([
        {
          $match: {
            ...dateMatch,
            ...utmFilter,
            'metadata.utm_campaign': campaign.utm_campaign,
          },
        },
        {
          $group: {
            _id: '$session_id',
            terms: { $addToSet: '$metadata.utm_term' },
            contents: { $addToSet: '$metadata.utm_content' },
          },
        },
      ]);

      const sessionIds = sessionAgg.map((s) => s._id);

      // Gom mảng term và content từ lịch sử behavior để xuất ra báo cáo
      const allTerms = [
        ...new Set(sessionAgg.flatMap((s) => s.terms).filter(Boolean)),
      ].join(', ');
      const allContents = [
        ...new Set(sessionAgg.flatMap((s) => s.contents).filter(Boolean)),
      ].join(', ');

      const orderAgg = await this.orderModel.aggregate<{
        orders: number;
        revenue: number;
      }>([
        {
          $match: {
            ...dateMatch,
            session_id: { $in: sessionIds },
            status: { $nin: this.EXCLUDED_STATUSES },
          },
        },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            revenue: { $sum: '$total_amount' },
          },
        },
      ]);

      const stat = orderAgg[0] || { orders: 0, revenue: 0 };
      const sessionsCount = sessionIds.length;
      const cr = sessionsCount > 0 ? (stat.orders / sessionsCount) * 100 : 0;

      // Ad Spend Ledger: chi phí = phần phân bổ rơi vào kỳ lọc (mục 3.4–3.5)
      const spendInPeriod = allocateSpendInRange(
        spendEntriesByCampaign.get(String(campaign._id)) ?? [],
        spendRange?.start,
        spendRange?.end,
      );
      const netProfit = roundMoney(stat.revenue - spendInPeriod);
      const roi = this.calcRoi(stat.revenue, spendInPeriod);

      reports.push({
        campaign_id: String(campaign._id),
        campaign_name: campaign.name,
        status: campaign.status || 'ACTIVE',
        budget: campaign.budget || 0,
        utm: {
          utm_campaign: campaign.utm_campaign,
          utm_source: campaign.utm_source,
          utm_medium: campaign.utm_medium,
          utm_term: allTerms, // [FIX 3] - Cung cấp dữ liệu từ khóa cho Drill-down
          utm_content: allContents, // [FIX 3] - Cung cấp dữ liệu nội dung cho Drill-down
        },
        sessions: sessionsCount,
        orders: stat.orders,
        conversion_rate: Number(cr.toFixed(2)),
        allocated_revenue: stat.revenue,
        ad_spend: spendInPeriod,
        ad_spend_total: roundMoney(campaign.ad_spend || 0),
        roi_percent: roi,
        net_profit: netProfit,
        profit_status: this.toProfitStatus(roi),
      });
    }

    return reports.sort((a, b) => b.allocated_revenue - a.allocated_revenue);
  }

  // 2. THEO DÕI MÃ GIẢM GIÁ (Coupon Tracking)
  // Chỉ trả về mã CÓ phát sinh trong kỳ. Gom bằng aggregate: 4 truy vấn thay cho N+1.
  async getCouponPerformance(
    filter: CouponFilterDto,
  ): Promise<ICouponReport[]> {
    const dateMatch = this.buildDateMatch(filter);

    // 1. Đơn hợp lệ có dùng mã trong kỳ
    const orderStats = await this.orderModel.aggregate<{
      _id: string;
      success_count: number;
      total_revenue: number;
      total_discount: number;
      user_ids: (Types.ObjectId | null | undefined)[];
    }>([
      {
        $match: {
          ...dateMatch,
          status: { $nin: this.EXCLUDED_STATUSES },
          voucher_code: { $nin: [null, ''] },
        },
      },
      {
        $group: {
          _id: '$voucher_code',
          success_count: { $sum: 1 },
          total_revenue: { $sum: '$total_amount' },
          total_discount: { $sum: { $ifNull: ['$discount_amount', 0] } },
          user_ids: { $push: '$user_id' },
        },
      },
    ]);

    // 2. Lượt áp mã trong CÙNG kỳ (trước đây đếm toàn thời gian)
    const attemptStats = await this.behaviorModel.aggregate<{
      _id: string;
      attempts: number;
    }>([
      {
        $match: { ...dateMatch, 'metadata.voucher_code': { $nin: [null, ''] } },
      },
      { $group: { _id: '$metadata.voucher_code', attempts: { $sum: 1 } } },
    ]);

    const statMap = new Map(orderStats.map((s) => [String(s._id), s]));
    const attemptMap = new Map(
      attemptStats.map((a) => [String(a._id), a.attempts]),
    );
    const codes = [...new Set([...statMap.keys(), ...attemptMap.keys()])];
    if (codes.length === 0) return [];

    // 3. Mô tả mã
    const coupons = await this.couponModel
      .find({ code: { $in: codes } })
      .select('code description')
      .lean();
    const descMap = new Map(
      coupons.map((c) => [String(c.code), c.description]),
    );

    // 4. Khách mới / quay lại: 1 aggregate cho toàn bộ user liên quan
    const userIds = [
      ...new Set(
        orderStats
          .flatMap((s) => s.user_ids)
          .filter((id): id is Types.ObjectId => !!id)
          .map(String),
      ),
    ].map((id) => new Types.ObjectId(id));

    const userOrderCounts = userIds.length
      ? await this.orderModel.aggregate<{ _id: Types.ObjectId; count: number }>(
          [
            { $match: { user_id: { $in: userIds } } },
            { $group: { _id: '$user_id', count: { $sum: 1 } } },
          ],
        )
      : [];
    const countMap = new Map(
      userOrderCounts.map((u) => [String(u._id), u.count]),
    );

    const reports: ICouponReport[] = codes.map((code) => {
      const stat = statMap.get(code);
      const successCount = stat?.success_count ?? 0;
      const totalRevenue = stat?.total_revenue ?? 0;
      const totalDiscount = stat?.total_discount ?? 0;
      const attempts = Math.max(attemptMap.get(code) ?? 0, successCount);

      let newCust = 0;
      let retCust = 0;
      (stat?.user_ids ?? []).forEach((uid) => {
        if (!uid) return;
        if ((countMap.get(String(uid)) ?? 0) > 1) retCust++;
        else newCust++;
      });

      return {
        coupon_code: code,
        description: descMap.get(code) || `Coupon ${code}`,
        usage_count: attempts,
        success_count: successCount,
        conversion_rate:
          attempts > 0
            ? Number(((successCount / attempts) * 100).toFixed(2))
            : 0,
        total_revenue: totalRevenue,
        total_discount_cost: totalDiscount,
        cost_revenue_ratio:
          totalRevenue > 0
            ? Number(((totalDiscount / totalRevenue) * 100).toFixed(2))
            : 0,
        customer_segments: {
          new_customers: newCust,
          returning_customers: retCust,
        },
      };
    });

    // Doanh thu → số đơn → lượt áp mã
    return reports.sort(
      (a, b) =>
        b.total_revenue - a.total_revenue ||
        b.success_count - a.success_count ||
        b.usage_count - a.usage_count,
    );
  }

  // 3. ĐO LƯỜNG SỨC KHỎE LOYALTY (Loyalty Health)
  async getLoyaltyHealth(
    filter: LoyaltyFilterDto,
  ): Promise<ILoyaltyHealthReport> {
    // FIX LỖI ESLINT: Sử dụng filter để thiết lập khoảng thời gian (AC2)
    const dateMatch = this.buildDateMatch(filter);

    const totalMembers = await this.customerModel.countDocuments();

    // Tính điểm trong kỳ
    const pointsAgg = await this.loyaltyModel.aggregate<{
      _id: string;
      total: number;
    }>([
      { $match: dateMatch },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);

    let earned = 0;
    let redeemed = 0;
    pointsAgg.forEach((p) => {
      if (p._id === 'EARN' || p._id === 'BIRTHDAY') earned += p.total;
      if (p._id === 'REDEEM') redeemed += Math.abs(p.total);
    });

    // Retention Rate & Frequency (Dựa trên thời gian filter)
    // [FIX 1] - Đếm tần suất mua hàng bằng dữ liệu THẬT (sử dụng $ifNull để gom nhóm Guest bằng session_id)
    const orderStats = await this.orderModel.aggregate<{
      _id: string | Types.ObjectId | null;
      is_member: boolean;
      count: number;
    }>([
      { $match: { status: { $nin: this.EXCLUDED_STATUSES }, ...dateMatch } },
      {
        $group: {
          // Nhóm theo user_id nếu là thành viên, ưu tiên email cho khách vãng lai, cuối cùng mới dùng session_id
          _id: {
            $ifNull: [
              '$user_id',
              { $ifNull: ['$shipping_info.email', '$session_id'] },
            ],
          },
          is_member: {
            $first: { $cond: [{ $ifNull: ['$user_id', false] }, true, false] },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    let memberOrders = 0;
    let guestOrders = 0;
    let returningMembers = 0;
    let totalActiveMembers = 0;
    let totalGuestSessions = 0;

    orderStats.forEach((stat) => {
      if (stat.is_member) {
        totalActiveMembers++;
        memberOrders += stat.count;
        if (stat.count >= 2) returningMembers++;
      } else {
        totalGuestSessions++; // Đếm số lượng phiên khách vãng lai duy nhất
        guestOrders += stat.count;
      }
    });

    const retention =
      totalActiveMembers > 0
        ? (returningMembers / totalActiveMembers) * 100
        : 0;
    const avgMemberFreq =
      totalActiveMembers > 0 ? memberOrders / totalActiveMembers : 0;

    // Đã thay thế số 1.05 giả lập bằng công thức tính toán thật
    const avgGuestFreq =
      totalGuestSessions > 0 ? guestOrders / totalGuestSessions : 0;

    // Tier Analysis (Không bị ảnh hưởng bởi time filter vì là Life Time Value)
    const tierAgg = await this.customerModel.aggregate<{
      _id: string;
      totalLTV: number;
      totalAOV: number;
    }>([
      {
        $group: {
          _id: '$loyalty.tier',
          totalLTV: { $sum: '$loyalty.total_spent' },
          userCount: { $sum: 1 },
        },
      },
    ]);

    const tierAnalysis = tierAgg.map((t) => ({
      tier: t._id || DEFAULT_TIER_CODE,
      total_revenue: t.totalLTV,
      aov: t.totalLTV / (t['userCount'] || 1),
      ltv: t.totalLTV / (t['userCount'] || 1),
    }));

    const totalRevenue = tierAnalysis.reduce(
      (acc, curr) => acc + curr.total_revenue,
      0,
    );
    const costOfLoyalty =
      totalRevenue > 0 ? (redeemed / totalRevenue) * 100 : 0;

    return {
      overview: {
        total_members: totalMembers,
        total_earned_points: earned,
        total_redeemed_points: redeemed,
      },
      retention_rate: Number(retention.toFixed(2)),
      frequency: {
        member_avg_orders: Number(avgMemberFreq.toFixed(2)),
        guest_avg_orders: Number(avgGuestFreq.toFixed(2)),
      },
      burn_rate:
        earned > 0 ? Number(((redeemed / earned) * 100).toFixed(2)) : 0,
      tier_analysis: tierAnalysis,
      cost_of_loyalty: Number(costOfLoyalty.toFixed(2)),
    };
  }

  // ================= AD SPEND LEDGER (US.82 AC1) =================

  // Thêm 1 dòng chi phí + $inc cache ad_spend trong CÙNG transaction
  async addAdSpendEntry(
    campaignId: string,
    dto: CreateAdSpendEntryDto,
    actorId: string,
  ): Promise<IAdSpendMutationResult> {
    this.assertObjectId(campaignId, 'Mã chiến dịch không hợp lệ.');

    const amount = Number(dto.amount);
    const cents = toCents(amount);
    if (
      !Number.isFinite(amount) ||
      cents <= 0 ||
      cents > 100_000_000_000 ||
      Math.abs(amount * 100 - cents) > 1e-6
    ) {
      throw new BadRequestException(
        'Số tiền phải lớn hơn 0, tối đa 1.000.000.000 và tối đa 2 chữ số thập phân.',
      );
    }

    const periodStart = this.parseEntryDay(dto.period_start, 'Ngày bắt đầu');
    const periodEnd = this.parseEntryDay(dto.period_end, 'Ngày kết thúc');
    if (periodStart > periodEnd) {
      throw new BadRequestException(
        'Ngày bắt đầu không được sau ngày kết thúc.',
      );
    }
    if (periodEnd > this.vnToday()) {
      throw new BadRequestException(
        'Ngày kết thúc không được ở tương lai — chi phí chưa thể phát sinh.',
      );
    }

    const campaign = await this.campaignModel
      .findById(campaignId)
      .select('name start_date end_date')
      .lean();
    if (!campaign) throw new NotFoundException('Không tìm thấy chiến dịch.');

    // Mục 7 #2: kỳ áp dụng phải nằm trong thời gian chạy chiến dịch (chặn cứng)
    const campaignStart = this.toVnDayStart(campaign.start_date);
    const campaignEnd = campaign.end_date
      ? this.toVnDayStart(campaign.end_date)
      : null;
    if (
      periodStart < campaignStart ||
      (campaignEnd && periodEnd > campaignEnd)
    ) {
      const window = `${this.vnDayLabel(campaignStart)} → ${
        campaignEnd ? this.vnDayLabel(campaignEnd) : 'nay'
      }`;
      throw new BadRequestException(
        `Kỳ áp dụng phải nằm trong thời gian chạy chiến dịch (${window}).`,
      );
    }

    const value = cents / 100;
    const note = dto.note?.trim() || undefined;
    let entryId = '';
    let newTotal = 0;

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const [entry] = await this.adSpendModel.create(
          [
            {
              campaign_id: new Types.ObjectId(campaignId),
              amount: value,
              period_start: periodStart,
              period_end: periodEnd,
              note,
              created_by: this.toObjectIdOrNull(actorId),
            },
          ],
          { session },
        );
        const updated = await this.campaignModel
          .findByIdAndUpdate(
            campaignId,
            { $inc: { ad_spend: value } },
            { new: true, session },
          )
          .select('ad_spend')
          .lean();
        if (!updated) throw new NotFoundException('Không tìm thấy chiến dịch.');

        entryId = String(entry._id);
        newTotal = roundMoney(updated.ad_spend);
      });
    } finally {
      await session.endSession();
    }

    await this.auditLogsService.log({
      action: 'AD_SPEND_ADDED',
      collection_name: 'ad_spend_entries',
      actor_id: actorId,
      target_id: entryId,
      department: Department.ACCOUNTING,
      detail: {
        campaign_id: campaignId,
        entry_id: entryId,
        amount: value,
        period_start: this.vnDayKeyOf(periodStart),
        period_end: this.vnDayKeyOf(periodEnd),
        note: note ?? null,
        old_total: roundMoney(newTotal - value),
        new_total: newTotal,
      },
    });

    return { entry_id: entryId, lifetime_total: newTotal };
  }

  // Hủy 1 dòng (bắt buộc lý do) + $inc âm cache ad_spend trong CÙNG transaction
  async voidAdSpendEntry(
    campaignId: string,
    entryId: string,
    reason: string,
    actorId: string,
  ): Promise<IAdSpendMutationResult> {
    this.assertObjectId(campaignId, 'Mã chiến dịch không hợp lệ.');
    this.assertObjectId(entryId, 'Mã dòng chi phí không hợp lệ.');
    const voidReason = (reason ?? '').trim();
    if (!voidReason) throw new BadRequestException('Vui lòng nhập lý do hủy.');

    const campaignOid = new Types.ObjectId(campaignId);
    const entryOid = new Types.ObjectId(entryId);
    let amount = 0;
    let periodStart = '';
    let periodEnd = '';
    let newTotal = 0;

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        // Điều kiện is_voided: false → không thể hủy 1 dòng 2 lần, kể cả khi bấm đồng thời
        const entry = await this.adSpendModel
          .findOneAndUpdate(
            { _id: entryOid, campaign_id: campaignOid, is_voided: false },
            {
              $set: {
                is_voided: true,
                voided_by: this.toObjectIdOrNull(actorId),
                voided_at: new Date(),
                void_reason: voidReason,
              },
            },
            { new: true, session },
          )
          .lean();

        if (!entry) {
          const exists = await this.adSpendModel
            .exists({ _id: entryOid, campaign_id: campaignOid })
            .session(session);
          if (exists) {
            throw new ConflictException('Dòng chi phí này đã bị hủy trước đó.');
          }
          throw new NotFoundException(
            'Không tìm thấy dòng chi phí của chiến dịch này.',
          );
        }

        const updated = await this.campaignModel
          .findByIdAndUpdate(
            campaignOid,
            { $inc: { ad_spend: -entry.amount } },
            { new: true, session },
          )
          .select('ad_spend')
          .lean();
        if (!updated) throw new NotFoundException('Không tìm thấy chiến dịch.');

        amount = entry.amount;
        periodStart = this.vnDayKeyOf(entry.period_start);
        periodEnd = this.vnDayKeyOf(entry.period_end);
        newTotal = roundMoney(updated.ad_spend);
      });
    } finally {
      await session.endSession();
    }

    await this.auditLogsService.log({
      action: 'AD_SPEND_VOIDED',
      collection_name: 'ad_spend_entries',
      actor_id: actorId,
      target_id: entryId,
      department: Department.ACCOUNTING,
      detail: {
        campaign_id: campaignId,
        entry_id: entryId,
        amount,
        period_start: periodStart,
        period_end: periodEnd,
        reason: voidReason,
        old_total: roundMoney(newTotal + amount),
        new_total: newTotal,
      },
    });

    return { entry_id: entryId, lifetime_total: newTotal };
  }

  // Nhật ký chi phí của 1 chiến dịch (mới nhất trước) + tổng toàn thời gian + tổng trong kỳ
  async getAdSpendEntries(
    campaignId: string,
    query: AdSpendEntryQueryDto,
  ): Promise<IAdSpendEntryList> {
    this.assertObjectId(campaignId, 'Mã chiến dịch không hợp lệ.');
    const campaign = await this.campaignModel
      .findById(campaignId)
      .select('ad_spend')
      .lean();
    if (!campaign) throw new NotFoundException('Không tìm thấy chiến dịch.');

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const filter = { campaign_id: new Types.ObjectId(campaignId) };
    const spendRange = this.buildSpendRange(query);

    const [total, rows, periodEntries] = await Promise.all([
      this.adSpendModel.countDocuments(filter),
      this.adSpendModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('created_by', ACTOR_FIELDS)
        .populate('voided_by', ACTOR_FIELDS)
        .lean<AdSpendEntryRow[]>(),
      spendRange
        ? this.loadSpendEntries([campaignId], spendRange)
        : Promise.resolve(null),
    ]);

    return {
      campaign_id: campaignId,
      lifetime_total: roundMoney(campaign.ad_spend || 0),
      period_total:
        periodEntries && spendRange
          ? allocateSpendInRange(
              periodEntries.get(campaignId) ?? [],
              spendRange.start,
              spendRange.end,
            )
          : null,
      entries: rows.map((r) => this.toEntryView(r)),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ---------- Hàm phụ Ad Spend Ledger ----------

  private buildSpendRange(filter: {
    start_date?: string;
    end_date?: string;
  }): VnDayRange | null {
    if (!filter.start_date || !filter.end_date) return null;
    return toVnDayRange(filter.start_date, filter.end_date);
  }

  // 1 truy vấn: mọi dòng CHƯA hủy của các chiến dịch, giao với kỳ (nếu có), gom theo campaign_id
  private async loadSpendEntries(
    campaignIds: string[],
    range: VnDayRange | null,
  ): Promise<Map<string, AllocatableSpendEntry[]>> {
    const result = new Map<string, AllocatableSpendEntry[]>();
    const ids = campaignIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (ids.length === 0) return result;

    const rows = await this.adSpendModel
      .find({
        campaign_id: { $in: ids },
        is_voided: false,
        ...(range
          ? {
              period_start: { $lte: range.end },
              period_end: { $gte: range.start },
            }
          : {}),
      })
      .select('campaign_id amount period_start period_end')
      .lean<
        Array<{
          campaign_id: Types.ObjectId;
          amount: number;
          period_start: Date;
          period_end: Date;
        }>
      >();

    rows.forEach((r) => {
      const key = String(r.campaign_id);
      const list = result.get(key) ?? [];
      list.push({
        amount: r.amount,
        period_start: r.period_start,
        period_end: r.period_end,
      });
      result.set(key, list);
    });
    return result;
  }

  // Mục 7 #3: chi phí trong kỳ = 0 → null (UI hiển thị "—")
  private calcRoi(revenue: number, spend: number): number | null {
    if (spend <= 0) return null;
    return Number((((revenue - spend) / spend) * 100).toFixed(2));
  }

  private toProfitStatus(roi: number | null): ProfitStatus {
    if (roi === null) return 'NO_SPEND';
    if (roi > 0) return 'PROFIT';
    if (roi < 0) return 'LOSS';
    return 'BREAK_EVEN';
  }

  private assertObjectId(id: string, message: string): void {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException(message);
  }

  private toObjectIdOrNull(id?: string | null): Types.ObjectId | null {
    return id && Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
  }

  // "YYYY-MM-DD" (hoặc ISO) → 00:00 giờ VN của đúng ngày người dùng chọn
  private parseEntryDay(value: string, label: string): Date {
    const p = parseVnDate(value ?? '');
    if (!p) throw new BadRequestException(`${label} không hợp lệ.`);
    return vnStartOfDay(p.y, p.m, p.d);
  }

  private toVnDayStart(date: Date): Date {
    const p = toVnParts(new Date(date));
    return vnStartOfDay(p.y, p.m, p.d);
  }

  private vnToday(): Date {
    return this.toVnDayStart(new Date());
  }

  private vnDayKeyOf(date: Date): string {
    return vnDayKey(toVnDayIndex(new Date(date)));
  }

  private vnDayLabel(date: Date): string {
    return formatVnDate(this.vnDayKeyOf(date));
  }

  private toActor(
    actor: PopulatedActor | null | undefined,
  ): IAdSpendActor | null {
    if (!actor) return null;
    const name =
      actor.fullName ||
      `${actor.last_Name ?? ''} ${actor.first_Name ?? ''}`.trim() ||
      actor.email ||
      'Unknown';
    return { _id: String(actor._id), name, email: actor.email };
  }

  private toEntryView(row: AdSpendEntryRow): IAdSpendEntryView {
    return {
      entry_id: String(row._id),
      campaign_id: String(row.campaign_id),
      amount: row.amount,
      period_start: this.vnDayKeyOf(row.period_start),
      period_end: this.vnDayKeyOf(row.period_end),
      note: row.note,
      created_by: this.toActor(row.created_by),
      created_at: row.createdAt,
      is_voided: row.is_voided,
      voided_by: this.toActor(row.voided_by),
      voided_at: row.voided_at,
      void_reason: row.void_reason,
    };
  }

  // BỔ SUNG: US1 - AC8 & US4 - AC5 (Biểu đồ xu hướng theo thời gian)
  async getCampaignTrend(
    campaignId: string,
    filter: TrackingFilterDto,
  ): Promise<ICampaignTrend[]> {
    if (!Types.ObjectId.isValid(campaignId)) {
      throw new BadRequestException('Mã chiến dịch không hợp lệ.');
    }
    const campaign = await this.campaignModel.findById(campaignId).lean();
    if (!campaign) throw new NotFoundException('Không tìm thấy chiến dịch.');

    const dateMatch = this.buildDateMatch(filter);

    const sessionTrend = await this.behaviorModel.aggregate<{
      _id: string;
      count: number;
    }>([
      {
        $match: {
          ...dateMatch,
          'metadata.utm_campaign': campaign.utm_campaign,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: 'Asia/Ho_Chi_Minh',
            },
          },
          sessions: { $addToSet: '$session_id' },
        },
      },
      { $project: { count: { $size: '$sessions' } } },
    ]);

    const allSessions = await this.behaviorModel.distinct('session_id', {
      'metadata.utm_campaign': campaign.utm_campaign,
    });

    const orderTrend = await this.orderModel.aggregate<{
      _id: string;
      orders: number;
      revenue: number;
    }>([
      {
        $match: {
          ...dateMatch,
          session_id: { $in: allSessions },
          status: { $nin: this.EXCLUDED_STATUSES },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: 'Asia/Ho_Chi_Minh',
            },
          },
          orders: { $sum: 1 },
          revenue: { $sum: '$total_amount' },
        },
      },
    ]);

    // Ad Spend Ledger: chi phí phân bổ theo từng ngày trong kỳ (US.82 AC5)
    const spendRange = this.buildSpendRange(filter);
    const spendEntries = await this.loadSpendEntries([campaignId], spendRange);
    const spendByDay = allocateSpendByDay(
      spendEntries.get(campaignId) ?? [],
      spendRange?.start,
      spendRange?.end,
    );

    const trendMap = new Map<string, ICampaignTrend>();
    const pointOf = (date: string): ICampaignTrend => {
      let item = trendMap.get(date);
      if (!item) {
        item = { date, sessions: 0, orders: 0, revenue: 0, spend: 0 };
        trendMap.set(date, item);
      }
      return item;
    };

    sessionTrend.forEach((s) => {
      pointOf(s._id).sessions = s.count;
    });
    orderTrend.forEach((o) => {
      const item = pointOf(o._id);
      item.orders = o.orders;
      item.revenue = o.revenue;
    });
    spendByDay.forEach((spend, date) => {
      pointOf(date).spend = spend;
    });

    return Array.from(trendMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  // BỔ SUNG: US2 - AC2 (Tra cứu chi tiết đơn hàng dùng mã)
  async getOrdersByCoupon(
    couponCode: string,
    filter: CouponFilterDto,
  ): Promise<ICouponOrderDetail[]> {
    const dateMatch: Record<string, unknown> = {
      voucher_code: couponCode,
      status: { $nin: this.EXCLUDED_STATUSES },
      ...this.buildDateMatch(filter),
    };

    const orders = await this.orderModel
      .find(dateMatch)
      .select(
        'order_code shipping_info total_amount discount_amount status createdAt',
      )
      .sort({ createdAt: -1 })
      .lean();

    return orders.map((o) => ({
      order_code: o.order_code,
      customer_name: o.shipping_info?.name || 'Khách vãng lai',
      customer_email: o.shipping_info?.email,
      total_amount: o.total_amount,
      discount_amount: o.discount_amount || 0,
      status: o.status,
      created_at: o.createdAt || new Date(),
    }));
  }

  // XUẤT EXCEL BÁO CÁO CHIẾN DỊCH (US.79 AC6 · US.95 AC1, AC5, AC7)
  async generateCampaignsExcel(
    filter: TrackingFilterDto,
    user: UserExportInfo,
  ): Promise<ExcelJS.Workbook> {
    const data = await this.getCampaignPerformance(filter);

    // Định dạng tiền: đổi tại 1 chỗ này khi PO chốt đơn vị tiền tệ (US.87 AC8 ghi VNĐ)
    const MONEY_FMT = '"$"#,##0.00';

    // [Tiêu đề cột, độ rộng] — US.79 AC6 yêu cầu đủ UTM tags
    const columns: Array<[string, number]> = [
      ['STT', 22],
      ['Chiến Dịch', 38],
      ['Nguồn (Source)', 16],
      ['Phương tiện (Medium)', 20],
      ['Mã chiến dịch (Campaign)', 24],
      ['Từ khóa (Term)', 24],
      ['Nội dung (Content)', 24],
      ['Sessions', 12],
      ['Orders', 10],
      ['CR (%)', 10],
      ['Doanh Thu', 18],
      ['Chi Phí (trong kỳ)', 18],
      ['Tổng Chi Phí (toàn thời gian)', 22],
      ['Lợi Nhuận', 18],
      ['ROI (%)', 12],
      ['Trạng Thái', 16],
    ];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'H&N Odyssey System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Báo Cáo Marketing', {
      views: [{ showGridLines: false, state: 'frozen', ySplit: 8 }],
    });

    columns.forEach(([, width], idx) => {
      sheet.getColumn(idx + 1).width = width;
    });
    const lastColLetter = sheet.getColumn(columns.length).letter;

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    // 1. BANNER TIÊU ĐỀ
    sheet.mergeCells(`A1:${lastColLetter}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value =
      'HỆ THỐNG QUẢN TRỊ H&N ODYSSEY - BÁO CÁO HIỆU QUẢ MARKETING';
    titleCell.font = {
      name: 'Segoe UI',
      size: 16,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 50;

    // 2. NGƯỜI XUẤT & KỲ BÁO CÁO (US.95 AC7, AC3)
    const displayName =
      user.fullName ||
      `${user.lastName ?? ''} ${user.firstName ?? ''}`.trim() ||
      'Không xác định';

    const infoRows = [
      { label: '👤 Người xuất:', value: displayName },
      { label: '📧 Email:', value: user.email || 'N/A' },
      {
        label: '📅 Ngày xuất:',
        value: new Date().toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        }),
      },
      {
        label: '🔍 Kỳ báo cáo:',
        value:
          filter.start_date && filter.end_date
            ? `${formatVnDate(filter.start_date)} ➔ ${formatVnDate(filter.end_date)}`
            : 'Toàn thời gian',
      },
    ];

    infoRows.forEach((item, idx) => {
      const rowNum = idx + 3;
      sheet.getCell(`A${rowNum}`).value = item.label;
      sheet.getCell(`A${rowNum}`).font = {
        name: 'Segoe UI',
        bold: true,
        size: 10,
      };
      sheet.getCell(`B${rowNum}`).value = item.value;
      sheet.getCell(`B${rowNum}`).font = { name: 'Segoe UI', size: 10 };
    });

    // 3. TÓM TẮT (cột K–L)
    const totalRev = roundMoney(
      data.reduce((sum, d) => sum + d.allocated_revenue, 0),
    );
    const totalSpend = roundMoney(data.reduce((sum, d) => sum + d.ad_spend, 0));
    const totalProfit = roundMoney(totalRev - totalSpend);

    sheet.getCell('K2').value = 'TÓM TẮT HỆ THỐNG';
    sheet.getCell('K2').font = { bold: true, color: { argb: 'FF595959' } };

    const summaryRows: Array<[string, number, string]> = [
      ['Tổng Doanh Thu:', totalRev, 'FF2E7D32'],
      ['Tổng Chi Phí (trong kỳ):', totalSpend, 'FFC62828'],
      [
        'Lợi Nhuận Ròng:',
        totalProfit,
        totalProfit >= 0 ? 'FF2E7D32' : 'FFC62828',
      ],
    ];

    summaryRows.forEach(([label, value, color], idx) => {
      const rowNum = idx + 3;
      const labelCell = sheet.getCell(`K${rowNum}`);
      labelCell.value = label;
      labelCell.border = thinBorder;

      const valueCell = sheet.getCell(`L${rowNum}`);
      valueCell.value = value;
      valueCell.border = thinBorder;
      valueCell.font = { bold: true, color: { argb: color } };
      valueCell.numFmt = MONEY_FMT;
      valueCell.alignment = { horizontal: 'right' };
    });

    // 4. HEADER BẢNG DỮ LIỆU
    const tableHeaderRow = 8;
    const headerRow = sheet.getRow(tableHeaderRow);
    headerRow.values = columns.map(([title]) => title);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF34495E' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      cell.border = thinBorder;
    });
    // Bật lọc/sắp xếp ngay trên Excel (hỗ trợ US.79 AC2)
    sheet.autoFilter = `A${tableHeaderRow}:${lastColLetter}${tableHeaderRow}`;

    // 5. DỮ LIỆU — US.82 AC3: Xanh = lãi, Vàng = hòa vốn, Đỏ = lỗ
    const statusLabel: Record<ICampaignReport['profit_status'], string> = {
      PROFIT: 'CÓ LÃI',
      BREAK_EVEN: 'HÒA VỐN',
      LOSS: 'LỖ',
      NO_SPEND: 'CHƯA CÓ CHI PHÍ',
    };
    const statusColor: Record<ICampaignReport['profit_status'], string> = {
      PROFIT: 'FF2E7D32',
      BREAK_EVEN: 'FFB7791F',
      LOSS: 'FFC62828',
      NO_SPEND: 'FF64748B',
    };

    data.forEach((d, index) => {
      const row = sheet.addRow([
        index + 1,
        d.campaign_name,
        d.utm.utm_source ?? '',
        d.utm.utm_medium ?? '',
        d.utm.utm_campaign ?? '',
        d.utm.utm_term ?? '',
        d.utm.utm_content ?? '',
        d.sessions,
        d.orders,
        d.conversion_rate / 100,
        d.allocated_revenue,
        d.ad_spend,
        d.ad_spend_total,
        d.net_profit,
        d.roi_percent === null ? '—' : d.roi_percent / 100,
        statusLabel[d.profit_status],
      ]);

      row.height = 28;
      const isOdd = index % 2 === 1;

      for (let i = 1; i <= columns.length; i++) {
        const cell = row.getCell(i);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFEBEDEF' } },
          left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          bottom: { style: 'thin', color: { argb: 'FFEBEDEF' } },
          right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: i >= 2 && i <= 7 ? 'left' : 'center',
          wrapText: i === 6 || i === 7,
        };
        if (isOdd) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' },
          };
        }
      }

      row.getCell(10).numFmt = '0.00%';
      row.getCell(11).numFmt = MONEY_FMT; // Doanh thu
      row.getCell(12).numFmt = MONEY_FMT; // Chi phí trong kỳ
      row.getCell(13).numFmt = MONEY_FMT; // Tổng chi phí toàn thời gian
      row.getCell(14).numFmt = MONEY_FMT; // Lợi nhuận
      row.getCell(15).numFmt = '0.00%'; // ROI ("—" khi không có chi phí)
      row.getCell(16).font = {
        bold: true,
        color: { argb: statusColor[d.profit_status] },
      };
    });

    return workbook;
  }

  // Bắn Tracking cho Algolia Insights để Model tự học
  async sendAlgoliaInsight(
    action: 'CLICK' | 'VIEW' | 'ADD_TO_CART',
    userToken: string,
    objectID: string,
    widgetType: string,
    queryID?: string,
    position?: number,
  ): Promise<void> {
    let eventType: 'click' | 'conversion' | 'view';
    let eventName: string;

    switch (action) {
      case 'CLICK':
        eventType = 'click';
        eventName = `Clicked ${widgetType} Recommendation`;
        break;
      case 'ADD_TO_CART':
        eventType = 'conversion';
        eventName = `Added ${widgetType} Item To Cart`;
        break;
      case 'VIEW':
      default:
        eventType = 'view';
        eventName = `Viewed ${widgetType} Widget`;
        break;
    }

    // [FIX ESLINT]: Xóa dấu \ thừa trước dấu - (no-useless-escape)
    const cleanUserToken = (userToken || 'anonymous_user')
      .replace(/[^a-zA-Z0-9_=-]/g, '_')
      .substring(0, 64);

    const productIdsArray = objectID.includes(',')
      ? objectID.split(',')
      : [objectID];

    const eventPayload: IAlgoliaInsightEvent = {
      eventType,
      eventName,
      index: this.indexName,
      userToken: cleanUserToken,
      objectIDs: productIdsArray,
    };

    // View: không gửi queryID (Algolia không dùng queryID cho view)
    // Click: queryID bắt buộc đi kèm positions, thiếu position thì gửi như click thường
    // Conversion: chỉ cần queryID, không gửi positions
    if (queryID && action === 'CLICK' && position && position > 0) {
      eventPayload.queryID = queryID;
      eventPayload.positions = [position];
    } else if (queryID && action === 'ADD_TO_CART') {
      eventPayload.queryID = queryID;
    }

    // Đánh dấu conversion là "thêm giỏ" để Algolia tách riêng chỉ số Add-to-cart
    if (action === 'ADD_TO_CART') {
      eventPayload.eventSubtype = 'addToCart';
    }

    const data: IAlgoliaInsightPayload = {
      events: [eventPayload],
    };

    try {
      await axios.post(this.insightsApiUrl, data, {
        headers: this.headers,
        timeout: 2000,
      });
      this.logger.log(
        `[Algolia Insights] Đã đẩy event [${eventName}] cho SP [${objectID}] (User: ${cleanUserToken})`,
      );
    } catch (error: unknown) {
      // 1. Ép kiểu an toàn sang NodeSystemError thay vì any
      const sysError = error as NodeSystemError;

      // 2. Bắt chết các lỗi do môi trường mạng/Firewall/DNS của máy tính hiện tại
      if (['ENOTFOUND', 'ENOENT', 'ETIMEDOUT'].includes(sysError.code || '')) {
        this.logger.warn(
          `[Algolia Insights] Môi trường mạng chặn kết nối (DNS/Firewall). Đã bỏ qua đẩy data AI để không block hệ thống.`,
        );
        return; // Thoát êm ái, không văng lỗi đỏ
      }

      // 3. Xử lý các lỗi khác (VD: sai cấu hình API Key)
      const msg = sysError.message || String(error);
      this.logger.error(`[Algolia Insights] Thất bại: ${msg}`);

      if (
        error &&
        typeof error === 'object' &&
        'isAxiosError' in error &&
        'response' in error
      ) {
        const axiosErr = error as Record<string, unknown>;
        const response = axiosErr.response as
          | Record<string, unknown>
          | undefined;

        if (response && response.data !== undefined) {
          this.logger.error(
            `Chi tiết lỗi Algolia: ${JSON.stringify(response.data)}`,
          );
        }
      }
    }
  }

  // Hàm xử lý Frequency Capping
  async logImpressions(userToken: string, productIds: string[]) {
    try {
      for (const pId of productIds) {
        const key = `impression:${userToken}:${pId}`;
        const currentCount = (await this.cacheManager.get<number>(key)) || 0;
        // Tăng đếm và set TTL 24 giờ (86400000 ms)
        await this.cacheManager.set(key, currentCount + 1, 86400000);
      }
    } catch (error: unknown) {
      // Ép kiểu error: unknown để sửa lỗi unsafe call/member access
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Lỗi log impression: ${errorMessage}`);
    }
  }
}
