import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserBehavior,
  BehaviorAction,
  DeviceType,
} from './schemas/user-behavior.schema';
import { TrackEventDto, MergeSessionDto } from './dto/track-event.dto';
import { Cart } from 'src/modules/sales/cart/schemas/cart.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
  CouponFilterDto,
  LoyaltyFilterDto,
  TrackingFilterDto,
} from './dto/marketing-tracking.dto';
import {
  ICampaignReport,
  ICampaignTrend,
  ICouponOrderDetail,
  ICouponReport,
  ILoyaltyHealthReport,
} from 'src/common/interfaces/marketing-tracking.interface';
import * as ExcelJS from 'exceljs';

export interface UserExportInfo {
  fullName?: string;
  lastName?: string;
  firstName?: string;
  email?: string;
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private readonly EXCLUDED_STATUSES = ['CANCELLED', 'RETURNED', 'REFUNDED'];

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
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

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
  logEvent(dto: TrackEventDto): void {
    try {
      // AC2: Logic xác định Bounce (Thoát trang quá nhanh)
      const is_bounce = (dto.dwell_time_seconds ?? 0) < 3;

      const behavior = new this.behaviorModel({
        ...dto,
        is_bounce,
        user_id: dto.user_id ? new Types.ObjectId(dto.user_id) : undefined,
      });

      // KHÔNG DÙNG AWAIT ở đây để không chặn request của Frontend
      behavior.save().catch((err) => {
        this.logger.error(
          `Failed to save tracking event: ${(err as Error).message}`,
        );
      });
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

  // US5 - AC4: Gửi sự kiện mua hàng sang GA4 với thông tin thật
  async sendPurchaseEventToGA4(order: Order, clientId: string) {
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
    const dateMatch: Record<string, unknown> = {};
    if (filter.start_date && filter.end_date) {
      dateMatch.createdAt = {
        $gte: new Date(filter.start_date),
        $lte: new Date(filter.end_date),
      };
    }

    // [FIX 2] - Xử lý map bộ lọc UTM từ DTO
    const utmFilter: Record<string, unknown> = {};
    if (filter.utm_source) utmFilter['metadata.utm_source'] = filter.utm_source;
    if (filter.utm_medium) utmFilter['metadata.utm_medium'] = filter.utm_medium;

    const campaigns = await this.campaignModel.find().lean();
    const reports: ICampaignReport[] = [];

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

      const netProfit = stat.revenue - campaign.ad_spend;
      const roi =
        campaign.ad_spend > 0
          ? (netProfit / campaign.ad_spend) * 100
          : netProfit > 0
            ? 100
            : 0;

      let profitStatus: 'PROFIT' | 'BREAK_EVEN' | 'LOSS' = 'BREAK_EVEN';
      if (roi > 0) profitStatus = 'PROFIT';
      else if (roi < 0) profitStatus = 'LOSS';

      reports.push({
        campaign_id: String(campaign._id),
        campaign_name: campaign.name,
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
        ad_spend: campaign.ad_spend,
        roi_percent: Number(roi.toFixed(2)),
        net_profit: netProfit,
        profit_status: profitStatus,
      });
    }

    return reports.sort((a, b) => b.allocated_revenue - a.allocated_revenue);
  }

  // 2. THEO DÕI MÃ GIẢM GIÁ (Coupon Tracking)
  async getCouponPerformance(
    filter: CouponFilterDto,
  ): Promise<ICouponReport[]> {
    const coupons = await this.couponModel.find().lean();
    const reports: ICouponReport[] = [];

    for (const coupon of coupons) {
      const dateMatch: Record<string, unknown> = {
        voucher_code: coupon.code,
        status: { $nin: this.EXCLUDED_STATUSES },
      };
      if (filter.start_date && filter.end_date) {
        dateMatch.createdAt = {
          $gte: new Date(filter.start_date),
          $lte: new Date(filter.end_date),
        };
      }
      const validOrders = await this.orderModel
        .find(dateMatch)
        .select('user_id total_amount discount_amount')
        .lean();

      const successCount = validOrders.length;
      let totalRevenue = 0;
      let totalDiscount = 0;
      let newCust = 0;
      let retCust = 0;

      for (const order of validOrders) {
        totalRevenue += order.total_amount;
        totalDiscount += order.discount_amount || 0;

        if (order.user_id) {
          const userOrderCount = await this.orderModel.countDocuments({
            user_id: order.user_id,
          });
          if (userOrderCount > 1) retCust++;
          else newCust++;
        }
      }

      const totalAttemptsAgg = await this.behaviorModel.countDocuments({
        'metadata.voucher_code': coupon.code,
      });

      const totalAttempts =
        totalAttemptsAgg > successCount ? totalAttemptsAgg : successCount;

      const cr = totalAttempts > 0 ? (successCount / totalAttempts) * 100 : 0;
      const ratio = totalRevenue > 0 ? (totalDiscount / totalRevenue) * 100 : 0;

      reports.push({
        coupon_code: coupon.code,
        usage_count: totalAttempts,
        success_count: successCount,
        conversion_rate: Number(cr.toFixed(2)),
        total_revenue: totalRevenue,
        total_discount_cost: totalDiscount,
        cost_revenue_ratio: Number(ratio.toFixed(2)),
        customer_segments: {
          new_customers: newCust,
          returning_customers: retCust,
        },
      });
    }
    return reports.sort((a, b) => b.total_revenue - a.total_revenue);
  }

  // 3. ĐO LƯỜNG SỨC KHỎE LOYALTY (Loyalty Health)
  async getLoyaltyHealth(
    filter: LoyaltyFilterDto,
  ): Promise<ILoyaltyHealthReport> {
    // FIX LỖI ESLINT: Sử dụng filter để thiết lập khoảng thời gian (AC2)
    const dateMatch: Record<string, unknown> = {};
    if (filter.start_date && filter.end_date) {
      dateMatch.createdAt = {
        $gte: new Date(filter.start_date),
        $lte: new Date(filter.end_date),
      };
    }

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
          // Nhóm theo user_id nếu có (Member), ngược lại nhóm theo session_id (Guest)
          _id: { $ifNull: ['$user_id', '$session_id'] },
          // Đánh dấu true nếu là Member, false nếu là Guest
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
      tier: t._id || 'MEMBER',
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

  // BỔ SUNG: US4 - AC1 (Cập nhật chi phí quảng cáo thủ công)

  async updateAdSpend(campaignId: string, adSpend: number): Promise<void> {
    await this.campaignModel.findByIdAndUpdate(campaignId, {
      $set: { ad_spend: adSpend },
    });
  }

  // BỔ SUNG: US1 - AC8 & US4 - AC5 (Biểu đồ xu hướng theo thời gian)

  async getCampaignTrend(
    campaignId: string,
    filter: TrackingFilterDto,
  ): Promise<ICampaignTrend[]> {
    const campaign = await this.campaignModel.findById(campaignId).lean();
    if (!campaign) throw new Error('Không tìm thấy chiến dịch');

    const dateMatch: Record<string, unknown> = {};
    if (filter.start_date && filter.end_date) {
      dateMatch.createdAt = {
        $gte: new Date(filter.start_date),
        $lte: new Date(filter.end_date),
      };
    }

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

    const trendMap = new Map<string, ICampaignTrend>();

    sessionTrend.forEach((s) => {
      trendMap.set(s._id, {
        date: s._id,
        sessions: s.count,
        orders: 0,
        revenue: 0,
      });
    });

    orderTrend.forEach((o) => {
      if (trendMap.has(o._id)) {
        const item = trendMap.get(o._id)!;
        item.orders = o.orders;
        item.revenue = o.revenue;
      } else {
        trendMap.set(o._id, {
          date: o._id,
          sessions: 0,
          orders: o.orders,
          revenue: o.revenue,
        });
      }
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
    };

    if (filter.start_date && filter.end_date) {
      dateMatch.createdAt = {
        $gte: new Date(filter.start_date),
        $lte: new Date(filter.end_date),
      };
    }

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

  // XUẤT EXCEL BÁO CÁO CHIẾN DỊCH

  async generateCampaignsExcel(
    filter: TrackingFilterDto,
    user: UserExportInfo,
  ): Promise<ExcelJS.Workbook> {
    const data = await this.getCampaignPerformance(filter);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo Cáo Marketing', {
      views: [
        {
          showGridLines: false,
          state: 'frozen',
          ySplit: 8,
        },
      ],
    });

    // 1. CẤU HÌNH ĐỘ RỘNG CỘT
    const columnWidths = [22, 45, 15, 12, 15, 20, 20, 20, 15, 18];
    columnWidths.forEach((width, idx) => {
      sheet.getColumn(idx + 1).width = width;
    });

    // 2. BANNER TIÊU ĐỀ
    sheet.mergeCells('A1:J1');
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

    // 3. THÔNG TIN NGƯỜI XUẤT (Đã fix Unsafe Member Access)
    const displayName =
      user.fullName ||
      `${user.lastName ?? ''} ${user.firstName ?? ''}`.trim() ||
      'Quản trị viên';

    const displayEmail = user.email || 'N/A';

    const infoRows = [
      { label: '👤 Người xuất:', value: displayName },
      { label: '📧 Email:', value: displayEmail },
      { label: '📅 Ngày xuất:', value: new Date().toLocaleString('vi-VN') },
      {
        label: '🔍 Tham số lọc:',
        value: `${filter.start_date ?? 'Bắt đầu'} ➔ ${filter.end_date ?? 'Hiện tại'}`,
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

    // 4. BẢNG TÓM TẮT (SUMMARY)
    const totalRev = data.reduce(
      (sum, item) => sum + item.allocated_revenue,
      0,
    );
    const totalSpend = data.reduce((sum, item) => sum + item.ad_spend, 0);

    sheet.getCell('H2').value = 'TÓM TẮT HỆ THỐNG';
    sheet.getCell('H2').font = { bold: true, color: { argb: 'FF595959' } };

    const formatSummary = (
      cellRef: string,
      isValue = false,
      color?: string,
    ) => {
      const cell = sheet.getCell(cellRef);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      if (isValue) {
        cell.font = { bold: true, color: { argb: color || 'FF000000' } };
        cell.numFmt = '#,##0" ₫"';
        cell.alignment = { horizontal: 'right' };
      }
    };

    sheet.getCell('H3').value = 'Tổng Doanh Thu:';
    sheet.getCell('I3').value = totalRev;
    formatSummary('H3');
    formatSummary('I3', true, 'FF2E7D32');

    sheet.getCell('H4').value = 'Tổng Chi Phí:';
    sheet.getCell('I4').value = totalSpend;
    formatSummary('H4');
    formatSummary('I4', true, 'FFC62828');

    // 5. HEADER BẢNG DỮ LIỆU
    const tableHeaderRow = 8;
    const headerRow = sheet.getRow(tableHeaderRow);
    headerRow.values = [
      'STT',
      'Chiến Dịch',
      'Sessions',
      'Orders',
      'CR (%)',
      'Doanh Thu',
      'Chi Phí',
      'Lợi Nhuận',
      'ROI (%)',
      'Trạng Thái',
    ];
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF34495E' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // 6. ĐỔ DỮ LIỆU & RENDER BORDER
    data.forEach((d, index) => {
      const row = sheet.addRow([
        index + 1,
        d.campaign_name,
        d.sessions,
        d.orders,
        d.conversion_rate / 100,
        d.allocated_revenue,
        d.ad_spend,
        d.net_profit,
        d.roi_percent / 100,
        d.profit_status === 'PROFIT'
          ? 'CÓ LÃI'
          : d.profit_status === 'LOSS'
            ? 'LỖ'
            : 'HÒA VỐN',
      ]);

      row.height = 28;
      const isEven = index % 2 === 0;

      for (let i = 1; i <= 10; i++) {
        const cell = row.getCell(i);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFEBEDEF' } },
          left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          bottom: { style: 'thin', color: { argb: 'FFEBEDEF' } },
          right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (!isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' },
          };
        }
      }

      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(5).numFmt = '0.00%';
      row.getCell(6).numFmt = '#,##0" ₫"';
      row.getCell(7).numFmt = '#,##0" ₫"';
      row.getCell(8).numFmt = '#,##0" ₫"';
      row.getCell(9).numFmt = '0.00%';

      const statusCell = row.getCell(10);
      if (d.profit_status === 'PROFIT')
        statusCell.font = { color: { argb: 'FF2E7D32' }, bold: true };
      else if (d.profit_status === 'LOSS')
        statusCell.font = { color: { argb: 'FFC62828' }, bold: true };
    });

    return workbook;
  }
}
