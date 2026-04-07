import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import { Cart } from 'src/modules/sales/cart/schemas/cart.schema';
import {
  UserBehavior,
  BehaviorAction,
} from 'src/modules/recommendations/tracking/schemas/user-behavior.schema';
import {
  DashboardFilterDto,
  TimeFilter,
} from 'src/common/dtos/dashboard-filter.dto';
import {
  IRevenueReport,
  IRevenueTimelineAgg,
  IPaymentShareAgg,
  IRetentionReport,
  IAbandonedProductAgg,
  IVipCustomer,
  IConversionReport,
  IBounceAndAbandonmentReport,
} from 'src/common/interfaces/business-report.interface';
import { User } from 'src/modules/users/schemas/user.schema';
import { PriceHistory } from 'src/modules/products/catalog/schemas/price-history.schema.ts';

interface IRevenueFacetResult {
  timeline: IRevenueTimelineAgg[];
  paymentShare: IPaymentShareAgg[];
  totals: {
    totalRevenue: number;
    totalOrders: number;
    paidAmount: number;
    pendingAmount: number;
  }[];
}

interface IPreviousRevenueResult {
  _id: null;
  total: number;
}

export interface ISourceConversionAgg {
  _id: string; // Tên source (Direct, Google...)
  sessions: number;
  purchases: number;
  rate: number;
}

@Injectable()
export class BusinessReportsService {
  private readonly EXCLUDED_STATUSES = [
    'CANCELLED',
    'REFUNDED',
    'REFUND_PENDING',
    'REFUND_NEEDED',
    'DELIVERY_FAILED',
  ];

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectModel(UserBehavior.name) private behaviorModel: Model<UserBehavior>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(PriceHistory.name)
    private priceHistoryModel: Model<PriceHistory>,
  ) {}

  private getDateRange(filter: DashboardFilterDto): {
    start: Date;
    end: Date;
    prevStart: Date;
    prevEnd: Date;
  } {
    const end = new Date();
    let start = new Date();
    let prevStart = new Date();
    let prevEnd = new Date();

    if (filter.time_filter === TimeFilter.TODAY) {
      start.setHours(0, 0, 0, 0);
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
    } else if (filter.time_filter === TimeFilter.THIS_WEEK) {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(start.setDate(diff));
      start.setHours(0, 0, 0, 0);

      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 6);
      prevStart.setHours(0, 0, 0, 0);
    } else if (
      filter.time_filter === TimeFilter.CUSTOM &&
      filter.start_date &&
      filter.end_date
    ) {
      start = new Date(filter.start_date);
      start.setHours(0, 0, 0, 0);
      const e = new Date(filter.end_date);
      e.setHours(23, 59, 59, 999);
      end.setTime(e.getTime());

      const diffTime = Math.abs(end.getTime() - start.getTime());
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - diffTime);
    } else {
      start = new Date(start.getFullYear(), start.getMonth(), 1);
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);
    }

    return { start, end, prevStart, prevEnd };
  }

  // US1: REVENUE & CASH FLOW

  async getRevenueReport(filter: DashboardFilterDto): Promise<IRevenueReport> {
    const dates = this.getDateRange(filter);
    const isToday = filter.time_filter === TimeFilter.TODAY;

    const baseMatch: PipelineStage.Match = {
      $match: {
        status: { $nin: this.EXCLUDED_STATUSES },
        createdAt: { $gte: dates.start, $lte: dates.end },
      },
    };

    // [FIX]: Ép kiểu IRevenueFacetResult vào aggregate
    const aggregationResult =
      await this.orderModel.aggregate<IRevenueFacetResult>([
        baseMatch,
        {
          $facet: {
            timeline: [
              {
                $group: {
                  _id: isToday
                    ? {
                        $hour: {
                          date: '$createdAt',
                          timezone: 'Asia/Ho_Chi_Minh',
                        },
                      }
                    : {
                        $dateToString: {
                          format: '%Y-%m-%d',
                          date: '$createdAt',
                          timezone: 'Asia/Ho_Chi_Minh',
                        },
                      },
                  revenue: { $sum: '$total_amount' },
                  orders: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
            paymentShare: [
              {
                $group: {
                  _id: '$payment.method',
                  revenue: { $sum: '$total_amount' },
                },
              },
            ],
            totals: [
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: '$total_amount' },
                  totalOrders: { $sum: 1 },
                  paidAmount: {
                    $sum: {
                      $cond: [
                        { $eq: ['$payment.status', 'PAID'] },
                        '$total_amount',
                        0,
                      ],
                    },
                  },
                  pendingAmount: {
                    $sum: {
                      $cond: [
                        { $ne: ['$payment.status', 'PAID'] },
                        '$total_amount',
                        0,
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      ]);

    const result = aggregationResult[0] || {
      timeline: [],
      paymentShare: [],
      totals: [],
    };

    const timelineData: IRevenueTimelineAgg[] = result.timeline || [];
    const paymentShareData: IPaymentShareAgg[] = result.paymentShare || [];
    const totals = result.totals[0] || {
      totalRevenue: 0,
      totalOrders: 0,
      paidAmount: 0,
      pendingAmount: 0,
    };

    // [FIX]: Ép kiểu IPreviousRevenueResult vào aggregate
    const prevMatchResult =
      await this.orderModel.aggregate<IPreviousRevenueResult>([
        {
          $match: {
            status: { $nin: this.EXCLUDED_STATUSES },
            createdAt: { $gte: dates.prevStart, $lte: dates.prevEnd },
          },
        },
        { $group: { _id: null, total: { $sum: '$total_amount' } } },
      ]);
    const previousTotalRevenue =
      prevMatchResult.length > 0 ? prevMatchResult[0].total : 0;

    const currentTotalRevenue = totals.totalRevenue;
    let growthPercentage = 0;
    if (previousTotalRevenue > 0) {
      growthPercentage =
        ((currentTotalRevenue - previousTotalRevenue) / previousTotalRevenue) *
        100;
    } else if (currentTotalRevenue > 0) {
      growthPercentage = 100;
    }

    const aov =
      totals.totalOrders > 0
        ? Math.round(currentTotalRevenue / totals.totalOrders)
        : 0;

    const paymentShares = paymentShareData.map((p) => ({
      method: String(p._id),
      revenue: p.revenue,
      percentage:
        currentTotalRevenue > 0
          ? Number(((p.revenue / currentTotalRevenue) * 100).toFixed(2))
          : 0,
    }));

    return {
      currentTotalRevenue,
      previousTotalRevenue,
      growthPercentage: Number(growthPercentage.toFixed(2)),
      aov,
      timeline: timelineData.map((t) => ({
        label: isToday ? `${t._id}:00` : String(t._id),
        revenue: t.revenue,
        orders: t.orders,
      })),
      paymentShares,
      cashFlow: {
        paidAmount: totals.paidAmount,
        pendingAmount: totals.pendingAmount,
      },
    };
  }

  // US4: ABANDONED CART (ĐÃ TỐI ƯU HÓA AC3)

  async getAbandonedProducts(
    filter: DashboardFilterDto,
  ): Promise<IAbandonedProductAgg[]> {
    const dates = this.getDateRange(filter); // Lấy range thời gian từ filter
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const categoryMatch = filter.category_id
      ? { 'product_info.categories': filter.category_id }
      : {};

    interface TRawCartAgg {
      _id: { productId: string; sku: string };
      abandonedCount: number;
      product_info: { name: string; price: number };
    }

    const cartAgg = await this.cartModel.aggregate<TRawCartAgg>([
      {
        $match: {
          updatedAt: { $lt: oneHourAgo },
          'items.0': { $exists: true },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: { productId: '$items.product_id', sku: '$items.sku' },
          abandonedCount: { $sum: '$items.quantity' },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id.productId',
          foreignField: '_id',
          as: 'product_info',
        },
      },
      { $unwind: '$product_info' },
      { $match: categoryMatch },
      { $sort: { abandonedCount: -1 } },
      { $limit: 20 },
    ]);

    const result: IAbandonedProductAgg[] = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const item of cartAgg) {
      // TỐI ƯU AC3: Thêm filter thời gian để tính tỷ lệ bỏ giỏ chính xác theo kỳ
      const addToCartCount = await this.behaviorModel.countDocuments({
        action: BehaviorAction.ADD_TO_CART,
        'metadata.sku': item._id.sku,
        createdAt: { $gte: dates.start, $lte: dates.end }, // Chỉ tính lượt add-to-cart trong kỳ
      });

      // Tránh chia cho 0, nếu trong kỳ không có lượt add nào mới (do hàng tồn cũ) thì lấy chính số lượng abandoned
      const addCount =
        addToCartCount === 0 ? item.abandonedCount : addToCartCount;
      const rate = (item.abandonedCount / addCount) * 100;

      // AC4: Tương quan thay đổi giá
      const priceHistories = await this.priceHistoryModel
        .find({
          sku: item._id.sku,
          createdAt: { $gte: thirtyDaysAgo },
        })
        .sort({ createdAt: 1 })
        .lean();

      const abandonHistoryAgg = await this.behaviorModel.aggregate<{
        _id: string;
        count: number;
      }>([
        {
          $match: {
            action: BehaviorAction.ADD_TO_CART,
            'metadata.sku': item._id.sku,
            createdAt: { $gte: thirtyDaysAgo },
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
            count: { $sum: 1 },
          },
        },
      ]);

      const priceCorrelation: {
        date: string;
        price: number;
        abandonedCount: number;
      }[] = [];

      let currentPrice =
        priceHistories.length > 0
          ? priceHistories[0].old_price
          : item.product_info.price;

      for (let i = 0; i <= 30; i++) {
        const targetDate = new Date(thirtyDaysAgo);
        targetDate.setDate(targetDate.getDate() + i);
        const dateStr = targetDate.toISOString().split('T')[0];

        const priceChangeToday = priceHistories.find(
          (p) =>
            p.createdAt && p.createdAt.toISOString().split('T')[0] === dateStr,
        );
        if (priceChangeToday) {
          currentPrice = priceChangeToday.new_price;
        }

        const abandonData = abandonHistoryAgg.find((a) => a._id === dateStr);

        priceCorrelation.push({
          date: dateStr,
          price: currentPrice,
          abandonedCount: abandonData ? abandonData.count : 0,
        });
      }

      result.push({
        _id: item._id,
        sku: item._id.sku,
        productName: item.product_info.name,
        abandonedCount: item.abandonedCount,
        lostOpportunityValue: item.abandonedCount * item.product_info.price,
        abandonmentRate: Number(rate.toFixed(2)),
        priceCorrelation,
      });
    }

    return result.sort(
      (a, b) => b.lostOpportunityValue - a.lostOpportunityValue,
    );
  }

  // US5: KHÁCH HÀNG QUAY LẠI

  async getRetentionReport(
    filter: DashboardFilterDto,
  ): Promise<IRetentionReport> {
    const dates = this.getDateRange(filter);

    interface IRawOrderUser {
      _id: string;
      orderDates: Date[];
      totalSpent: number;
    }

    // Lấy toàn bộ ngày mua hàng của các User trong kỳ (Dùng cho Cohort và Tần suất)
    const orderAgg = await this.orderModel.aggregate<IRawOrderUser>([
      {
        $match: {
          status: { $nin: this.EXCLUDED_STATUSES },
          createdAt: { $gte: dates.start, $lte: dates.end },
          user_id: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$user_id',
          orderDates: { $push: '$createdAt' },
          totalSpent: { $sum: '$total_amount' },
        },
      },
    ]);

    let newCustCount = 0;
    let retCustCount = 0;
    let newCustRevenue = 0;
    let retCustRevenue = 0;
    let totalDaysBetween = 0;
    let validFreqCount = 0;

    const vipList: IVipCustomer[] = [];
    const churnRiskList: IVipCustomer[] = [];
    const CHURN_THRESHOLD_DAYS = 90; // AC6
    const now = new Date();

    // Dữ liệu cho AC7: Cohort Heatmap
    const cohortHeatmap: Record<string, Record<string, number>> = {};
    const userIds: Types.ObjectId[] = []; // Thu thập ID để tra cứu Loyalty Tier

    for (const user of orderAgg) {
      // Ép kiểu ObjectId an toàn
      const uId = new Types.ObjectId(user._id);
      userIds.push(uId);

      const datesAsc = user.orderDates.sort(
        (a, b) => a.getTime() - b.getTime(),
      );
      const firstOrder = datesAsc[0];
      const lastOrder = datesAsc[datesAsc.length - 1];
      const orderCount = datesAsc.length;

      if (orderCount > 1) {
        retCustCount++;
        retCustRevenue += user.totalSpent;

        const diffTime = Math.abs(lastOrder.getTime() - firstOrder.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        totalDaysBetween += diffDays > 0 ? diffDays / (orderCount - 1) : 1;
        validFreqCount++;
      } else {
        newCustCount++;
        newCustRevenue += user.totalSpent;
      }

      // VIP & Churn Risk (AC4, AC6)
      const uData: IVipCustomer = {
        userId: String(user._id),
        totalSpent: user.totalSpent,
        orderCount,
        lastOrderDate: lastOrder,
      };
      vipList.push(uData);

      const daysSinceLastOrder = Math.ceil(
        Math.abs(now.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceLastOrder >= CHURN_THRESHOLD_DAYS) {
        churnRiskList.push(uData);
      }

      // AC7: COHORT ANALYSIS LOGIC
      const cohortMonth = `${firstOrder.getFullYear()}-${String(
        firstOrder.getMonth() + 1,
      ).padStart(2, '0')}`;
      if (!cohortHeatmap[cohortMonth]) cohortHeatmap[cohortMonth] = {};

      cohortHeatmap[cohortMonth]['Month 0'] =
        (cohortHeatmap[cohortMonth]['Month 0'] || 0) + 1;

      const seenMonths = new Set<number>();
      for (let i = 1; i < datesAsc.length; i++) {
        const mDiff =
          (datesAsc[i].getFullYear() - firstOrder.getFullYear()) * 12 +
          (datesAsc[i].getMonth() - firstOrder.getMonth());
        if (mDiff > 0 && !seenMonths.has(mDiff)) {
          seenMonths.add(mDiff);
          const monthLabel = `Month ${mDiff}`;
          cohortHeatmap[cohortMonth][monthLabel] =
            (cohortHeatmap[cohortMonth][monthLabel] || 0) + 1;
        }
      }
    }

    for (const month in cohortHeatmap) {
      const baseUsers = cohortHeatmap[month]['Month 0'];
      for (const key in cohortHeatmap[month]) {
        if (key !== 'Month 0') {
          cohortHeatmap[month][key] = Number(
            ((cohortHeatmap[month][key] / baseUsers) * 100).toFixed(2),
          );
        }
      }
    }

    // AC8: PHÂN TÍCH TỶ LỆ QUAY LẠI THEO HẠNG THÀNH VIÊN (LOYALTY TIER)
    interface ILoyaltyUser {
      _id: Types.ObjectId;
      loyalty?: { tier: string };
    }
    const usersWithTier = await this.userModel
      .find({ _id: { $in: userIds } })
      .select('loyalty.tier')
      .lean<ILoyaltyUser[]>();

    const tierStats: Record<string, { total: number; ret: number }> = {};
    usersWithTier.forEach((u) => {
      const tier = u.loyalty?.tier || 'MEMBER';
      if (!tierStats[tier]) tierStats[tier] = { total: 0, ret: 0 };

      const orderData = orderAgg.find((o) => String(o._id) === String(u._id));
      if (orderData) {
        tierStats[tier].total++;
        if (orderData.orderDates.length > 1) {
          tierStats[tier].ret++;
        }
      }
    });

    const loyaltyRetention = Object.keys(tierStats).map((tier) => ({
      tier,
      totalCustomers: tierStats[tier].total,
      returningCustomers: tierStats[tier].ret,
      retentionRate:
        tierStats[tier].total > 0
          ? Number(
              ((tierStats[tier].ret / tierStats[tier].total) * 100).toFixed(2),
            )
          : 0,
    }));

    const totalCust = newCustCount + retCustCount;

    // BỔ SUNG LOGIC CHO AC5: XU HƯỚNG TỶ LỆ GIỮ CHÂN
    const trendMap: Record<string, { total: number; ret: number }> = {};
    for (const user of orderAgg) {
      const lastOrderInPeriod = user.orderDates.sort(
        (a, b) => b.getTime() - a.getTime(),
      )[0];
      const dateKey =
        filter.time_filter === TimeFilter.TODAY
          ? `${lastOrderInPeriod.getHours()}:00`
          : lastOrderInPeriod.toISOString().split('T')[0];

      if (!trendMap[dateKey]) trendMap[dateKey] = { total: 0, ret: 0 };
      trendMap[dateKey].total++;
      if (user.orderDates.length > 1) {
        trendMap[dateKey].ret++;
      }
    }

    const retentionTrend = Object.keys(trendMap)
      .sort()
      .map((key) => ({
        label: key,
        rate:
          trendMap[key].total > 0
            ? Number(
                ((trendMap[key].ret / trendMap[key].total) * 100).toFixed(2),
              )
            : 0,
      }));

    return {
      newCustomers: newCustCount,
      returningCustomers: retCustCount,
      retentionRate:
        totalCust > 0
          ? Number(((retCustCount / totalCust) * 100).toFixed(2))
          : 0,
      averagePurchaseFrequencyDays:
        validFreqCount > 0 ? Math.round(totalDaysBetween / validFreqCount) : 0,
      aovComparison: {
        newAov:
          newCustCount > 0 ? Math.round(newCustRevenue / newCustCount) : 0,
        returningAov:
          retCustCount > 0
            ? Math.round(
                retCustRevenue /
                  orderAgg.reduce(
                    (acc, u) =>
                      u.orderDates.length > 1 ? acc + u.orderDates.length : acc,
                    0,
                  ),
              )
            : 0,
      },
      vipList: vipList.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10),
      churnRiskList: churnRiskList
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 20),
      cohortHeatmap,
      loyaltyRetention,
      retentionTrend,
    };
  }

  // US2: CONVERSION & FUNNEL

  async getConversionReport(
    filter: DashboardFilterDto,
  ): Promise<IConversionReport> {
    const dates = this.getDateRange(filter);
    const targetKpi = filter.target_kpi || 2.5;
    const isToday = filter.time_filter === TimeFilter.TODAY;

    interface IConvAgg {
      _id: null;
      total: number;
      purchased: number;
      view: number;
      cart: number;
      checkout: number;
      deskTot: number;
      deskPur: number;
      mobTot: number;
      mobPur: number;
      newTot: number;
      newPur: number;
      retTot: number;
      retPur: number;
    }

    const aggResult = await this.behaviorModel.aggregate<IConvAgg>([
      { $match: { createdAt: { $gte: dates.start, $lte: dates.end } } },
      {
        $group: {
          _id: '$session_id',
          actions: { $addToSet: '$action' },
          device: { $first: '$device' },
          userId: { $first: '$user_id' },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          purchased: {
            $sum: {
              $cond: [{ $in: [BehaviorAction.PURCHASE, '$actions'] }, 1, 0],
            },
          },
          view: {
            $sum: {
              $cond: [{ $in: [BehaviorAction.VIEW_PRODUCT, '$actions'] }, 1, 0],
            },
          },
          cart: {
            $sum: {
              $cond: [{ $in: [BehaviorAction.ADD_TO_CART, '$actions'] }, 1, 0],
            },
          },
          checkout: {
            $sum: {
              $cond: [
                { $in: [BehaviorAction.BEGIN_CHECKOUT, '$actions'] },
                1,
                0,
              ],
            },
          },
          deskTot: { $sum: { $cond: [{ $eq: ['$device', 'DESKTOP'] }, 1, 0] } },
          deskPur: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$device', 'DESKTOP'] },
                    { $in: [BehaviorAction.PURCHASE, '$actions'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          mobTot: { $sum: { $cond: [{ $eq: ['$device', 'MOBILE'] }, 1, 0] } },
          mobPur: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$device', 'MOBILE'] },
                    { $in: [BehaviorAction.PURCHASE, '$actions'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          retTot: { $sum: { $cond: [{ $ne: ['$userId', null] }, 1, 0] } },
          retPur: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$userId', null] },
                    { $in: [BehaviorAction.PURCHASE, '$actions'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          newTot: { $sum: { $cond: [{ $eq: ['$userId', null] }, 1, 0] } },
          newPur: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$userId', null] },
                    { $in: [BehaviorAction.PURCHASE, '$actions'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    interface ITrendAgg {
      _id: string;
      total: number;
      pur: number;
    }

    // TIÊM TYPE TRỰC TIẾP VÀO ĐỂ FIX UNUSED VARS
    const trendAgg = await this.behaviorModel.aggregate<ITrendAgg>([
      { $match: { createdAt: { $gte: dates.start, $lte: dates.end } } },
      {
        $group: {
          _id: '$session_id',
          action: { $addToSet: '$action' },
          date: { $first: '$createdAt' },
        },
      },
      {
        $group: {
          _id: isToday
            ? { $hour: { date: '$date', timezone: 'Asia/Ho_Chi_Minh' } }
            : {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$date',
                  timezone: 'Asia/Ho_Chi_Minh',
                },
              },
          total: { $sum: 1 },
          pur: {
            $sum: {
              $cond: [{ $in: [BehaviorAction.PURCHASE, '$action'] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const sourceAgg = await this.behaviorModel.aggregate<ISourceConversionAgg>([
      { $match: { createdAt: { $gte: dates.start, $lte: dates.end } } },
      {
        $group: {
          _id: '$session_id',
          actions: { $addToSet: '$action' },
          source: { $first: '$source' },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$source', 'Direct'] },
          sessions: { $sum: 1 },
          purchases: {
            $sum: {
              $cond: [{ $in: [BehaviorAction.PURCHASE, '$actions'] }, 1, 0],
            },
          },
        },
      },
    ]);

    const stat = aggResult[0] || {
      total: 0,
      purchased: 0,
      view: 0,
      cart: 0,
      checkout: 0,
      deskTot: 0,
      deskPur: 0,
      mobTot: 0,
      mobPur: 0,
      newTot: 0,
      newPur: 0,
      retTot: 0,
      retPur: 0,
    };
    const cr = stat.total > 0 ? (stat.purchased / stat.total) * 100 : 0;

    return {
      overallConversionRate: Number(cr.toFixed(2)),
      isBelowKpi: cr < targetKpi,
      targetKpi,
      funnel: [
        {
          stepName: 'Xem SP',
          userCount: stat.view,
          dropOffRate:
            stat.total > 0
              ? Number(((1 - stat.view / stat.total) * 100).toFixed(2))
              : 0,
        },
        {
          stepName: 'Giỏ hàng',
          userCount: stat.cart,
          dropOffRate:
            stat.view > 0
              ? Number(((1 - stat.cart / stat.view) * 100).toFixed(2))
              : 0,
        },
        {
          stepName: 'Thanh toán',
          userCount: stat.checkout,
          dropOffRate:
            stat.cart > 0
              ? Number(((1 - stat.checkout / stat.cart) * 100).toFixed(2))
              : 0,
        },
        {
          stepName: 'Mua',
          userCount: stat.purchased,
          dropOffRate:
            stat.checkout > 0
              ? Number(((1 - stat.purchased / stat.checkout) * 100).toFixed(2))
              : 0,
        },
      ],
      bySource: sourceAgg.map((s) => ({
        _id: String(s._id),
        sessions: s.sessions,
        purchases: s.purchases,
        rate:
          s.sessions > 0
            ? Number(((s.purchases / s.sessions) * 100).toFixed(2))
            : 0,
      })),
      byDevice: {
        desktopCR:
          stat.deskTot > 0
            ? Number(((stat.deskPur / stat.deskTot) * 100).toFixed(2))
            : 0,
        mobileCR:
          stat.mobTot > 0
            ? Number(((stat.mobPur / stat.mobTot) * 100).toFixed(2))
            : 0,
      },
      byCustomerType: {
        newCustomerCR:
          stat.newTot > 0
            ? Number(((stat.newPur / stat.newTot) * 100).toFixed(2))
            : 0,
        returningCustomerCR:
          stat.retTot > 0
            ? Number(((stat.retPur / stat.retTot) * 100).toFixed(2))
            : 0,
      },
      trend: trendAgg.map((t) => ({
        label: isToday ? `${t._id}:00` : String(t._id),
        rate: t.total > 0 ? Number(((t.pur / t.total) * 100).toFixed(2)) : 0,
      })),
    };
  }

  // US3: BOUNCE RATE & CHECKOUT ABANDONMENT

  async getBounceAndAbandonmentReport(
    filter: DashboardFilterDto,
  ): Promise<IBounceAndAbandonmentReport> {
    const dates = this.getDateRange(filter);

    interface IBounceAgg {
      _id: null;
      tot: number;
      bounce: number;
      chk: number;
      ship: number;
      pay: number;
      pur: number;
      deskTot: number;
      deskAbn: number;
      mobTot: number;
      mobAbn: number;
    }

    const agg = await this.behaviorModel.aggregate<IBounceAgg>([
      { $match: { createdAt: { $gte: dates.start, $lte: dates.end } } },
      {
        $group: {
          _id: '$session_id',
          acts: { $addToSet: '$action' },
          cnt: { $sum: 1 },
          dev: { $first: '$device' },
        },
      },
      {
        $group: {
          _id: null,
          tot: { $sum: 1 },
          bounce: { $sum: { $cond: [{ $eq: ['$cnt', 1] }, 1, 0] } },
          chk: {
            $sum: {
              $cond: [{ $in: [BehaviorAction.BEGIN_CHECKOUT, '$acts'] }, 1, 0],
            },
          },
          ship: {
            $sum: {
              $cond: [
                { $in: [BehaviorAction.ADD_SHIPPING_INFO, '$acts'] },
                1,
                0,
              ],
            },
          },
          pay: {
            $sum: {
              $cond: [
                { $in: [BehaviorAction.ADD_PAYMENT_INFO, '$acts'] },
                1,
                0,
              ],
            },
          },
          pur: {
            $sum: {
              $cond: [{ $in: [BehaviorAction.PURCHASE, '$acts'] }, 1, 0],
            },
          },
          deskTot: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$dev', 'DESKTOP'] },
                    { $in: [BehaviorAction.BEGIN_CHECKOUT, '$acts'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          deskAbn: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$dev', 'DESKTOP'] },
                    { $in: [BehaviorAction.BEGIN_CHECKOUT, '$acts'] },
                    { $not: { $in: [BehaviorAction.PURCHASE, '$acts'] } },
                  ],
                },
                1,
                0,
              ],
            },
          },
          mobTot: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$dev', 'MOBILE'] },
                    { $in: [BehaviorAction.BEGIN_CHECKOUT, '$acts'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          mobAbn: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$dev', 'MOBILE'] },
                    { $in: [BehaviorAction.BEGIN_CHECKOUT, '$acts'] },
                    { $not: { $in: [BehaviorAction.PURCHASE, '$acts'] } },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // BỔ SUNG FIX TYPE CỤC BỘ CHO TREND VÀ SOURCE BỊ LỖI
    interface IBounceTrendAgg {
      _id: string | number;
      total: number;
      bounce: number;
    }

    const trendAgg = await this.behaviorModel.aggregate<IBounceTrendAgg>([
      { $match: { createdAt: { $gte: dates.start, $lte: dates.end } } },
      {
        $group: {
          _id: '$session_id',
          cnt: { $sum: 1 },
          date: { $first: '$createdAt' },
        },
      },
      {
        $group: {
          _id:
            filter.time_filter === TimeFilter.TODAY
              ? { $hour: { date: '$date', timezone: 'Asia/Ho_Chi_Minh' } }
              : {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$date',
                    timezone: 'Asia/Ho_Chi_Minh',
                  },
                },
          total: { $sum: 1 },
          bounce: { $sum: { $cond: [{ $eq: ['$cnt', 1] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    interface IBounceSourceAgg {
      _id: string;
      checkouts: number;
      abandoned: number;
    }

    const sourceAgg = await this.behaviorModel.aggregate<IBounceSourceAgg>([
      { $match: { createdAt: { $gte: dates.start, $lte: dates.end } } },
      {
        $group: {
          _id: '$session_id',
          acts: { $addToSet: '$action' },
          source: { $first: '$source' },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$source', 'Direct'] },
          checkouts: {
            $sum: {
              $cond: [{ $in: [BehaviorAction.BEGIN_CHECKOUT, '$acts'] }, 1, 0],
            },
          },
          abandoned: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: [BehaviorAction.BEGIN_CHECKOUT, '$acts'] },
                    { $not: { $in: [BehaviorAction.PURCHASE, '$acts'] } },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    interface IPageAgg {
      _id: string;
      view: number;
      bounce: number;
    }
    const pagesAgg = await this.behaviorModel.aggregate<IPageAgg>([
      { $match: { createdAt: { $gte: dates.start, $lte: dates.end } } },
      {
        $group: {
          _id: '$session_id',
          paths: { $push: '$path' },
          cnt: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: { $arrayElemAt: ['$paths', 0] },
          view: { $sum: 1 },
          bounce: { $sum: { $cond: [{ $eq: ['$cnt', 1] }, 1, 0] } },
        },
      },
      { $sort: { bounce: -1 } },
      { $limit: 10 },
    ]);

    const st = agg[0] || {
      tot: 0,
      bounce: 0,
      chk: 0,
      ship: 0,
      pay: 0,
      pur: 0,
      deskTot: 0,
      deskAbn: 0,
      mobTot: 0,
      mobAbn: 0,
    };

    return {
      bounceRate:
        st.tot > 0 ? Number(((st.bounce / st.tot) * 100).toFixed(2)) : 0,
      trend: trendAgg.map((t) => ({
        label:
          filter.time_filter === TimeFilter.TODAY
            ? `${t._id}:00`
            : String(t._id),
        rate: t.total > 0 ? Number(((t.bounce / t.total) * 100).toFixed(2)) : 0,
      })),
      topBouncedPages: pagesAgg.map((p) => ({
        path: String(p._id),
        sessions: p.view,
        bounceRate:
          p.view > 0 ? Number(((p.bounce / p.view) * 100).toFixed(2)) : 0,
      })),
      checkoutFunnel: {
        beginCheckout: st.chk,
        addShipping: st.ship,
        addPayment: st.pay,
        purchase: st.pur,
      },
      abandonment: {
        overallRate:
          st.chk > 0
            ? Number((((st.chk - st.pur) / st.chk) * 100).toFixed(2))
            : 0,
        byDevice: {
          desktopRate:
            st.deskTot > 0
              ? Number(((st.deskAbn / st.deskTot) * 100).toFixed(2))
              : 0,
          mobileRate:
            st.mobTot > 0
              ? Number(((st.mobAbn / st.mobTot) * 100).toFixed(2))
              : 0,
        },
        bySource: sourceAgg.map((s) => ({
          source: String(s._id),
          rate:
            s.checkouts > 0
              ? Number(((s.abandoned / s.checkouts) * 100).toFixed(2))
              : 0,
        })),
      },
    };
  }
}
