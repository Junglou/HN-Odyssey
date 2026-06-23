import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import {
  Category,
  CategoryDocument,
} from 'src/modules/products/categories/schemas/category.schema';
import {
  DashboardFilterDto,
  TopEntityFilterDto,
  SortBy,
  TimeFilter,
  SortOrder,
} from 'src/common/dtos/dashboard-filter.dto';

import {
  StockAlertItem,
  RawAggregatedProduct,
  OverviewMetrics,
  TopCategory,
  TopProduct,
  VariantContribution,
  SystemStageStat,
} from 'src/common/interfaces/dashboard.interface';
import { Conversation } from 'twilio/lib/twiml/VoiceResponse';
import {
  WarrantyClaim,
  WarrantyClaimDocument,
} from 'src/modules/support/warranty/schemas/warranty-claim.schema';
import {
  SystemMetric,
  SystemMetricDocument,
} from 'src/modules/system/monitoring/schemas/system-metric.schema';
import {
  IntegrationLog,
  IntegrationLogDocument,
} from 'src/modules/system/monitoring/schemas/integration-log.schema';
import {
  ConversationDocument,
  ConversationStatus,
} from 'src/modules/support/chat/schemas/conversation.schema';
import {
  StockTransaction,
  StockTransactionDocument,
} from 'src/modules/inventory/transactions/schemas/stock-transaction.schema';

interface RawAggregationResult {
  total_revenue: number;
  total_orders: number;
}

interface ChartRawData {
  _id: string;
  revenue: number;
  orders: number;
}

interface RawTopProductData {
  _id: Types.ObjectId;
  total_revenue: number;
  total_quantity: number;
  raw_variants: Array<{
    sku: string;
    variant_name?: string;
    quantity: number;
    revenue: number;
  }>;
  product_info: {
    name: string;
    thumbnail?: string;
  };
}

export interface InventoryKPI {
  title: string;
  value: string;
  subtext: string;
  iconType: 'box' | 'dollar' | 'truck' | 'refresh';
}

interface RawTopCategoryData {
  _id: Types.ObjectId;
  total_revenue: number;
  total_quantity: number;
  returned_quantity: number;
  total_ordered_quantity: number;
  category_info: {
    name: string;
  };
}

interface PrevEntityStat {
  _id: Types.ObjectId;
  total_revenue: number;
  total_quantity: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(WarrantyClaim.name)
    private readonly warrantyClaimModel: Model<WarrantyClaimDocument>,
    @InjectModel(SystemMetric.name)
    private readonly systemMetricModel: Model<SystemMetricDocument>,
    @InjectModel(IntegrationLog.name)
    private readonly integrationLogModel: Model<IntegrationLogDocument>,
    @InjectModel(StockTransaction.name)
    private readonly stockTransactionModel: Model<StockTransactionDocument>,
  ) {}

  // WIDGET CẢNH BÁO TỒN KHO
  async getStockAlertsWidget(): Promise<StockAlertItem[]> {
    const products = await this.productModel.aggregate<RawAggregatedProduct>([
      { $match: { is_deleted: false, status: 'ACTIVE' } },
      {
        $match: {
          $expr: {
            $or: [
              {
                $and: [
                  { $eq: ['$has_variants', false] },
                  {
                    $or: [
                      { $lte: ['$stock', '$min_stock'] },
                      { $gt: ['$stock', '$max_stock'] },
                    ],
                  },
                ],
              },
              {
                $and: [
                  { $eq: ['$has_variants', true] },
                  {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: '$variants',
                            as: 'v',
                            cond: {
                              $or: [
                                {
                                  $lte: [
                                    '$$v.stock',
                                    {
                                      $ifNull: ['$$v.min_stock', '$min_stock'],
                                    },
                                  ],
                                },
                                {
                                  $gt: [
                                    '$$v.stock',
                                    {
                                      $ifNull: ['$$v.max_stock', '$max_stock'],
                                    },
                                  ],
                                },
                              ],
                            },
                          },
                        },
                      },
                      0,
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
    ]);

    const alerts: StockAlertItem[] = [];

    for (const product of products) {
      if (!product.has_variants) {
        let status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OVER_STOCK' = 'LOW_STOCK';
        let priority = 2;

        if (product.stock <= 0) {
          status = 'OUT_OF_STOCK';
          priority = 1;
        } else if (product.stock > product.max_stock) {
          status = 'OVER_STOCK';
          priority = 3;
        }

        alerts.push({
          product_id: product._id.toString(),
          sku: product.sku,
          name: product.name,
          thumbnail: product.thumbnail || '',
          current_stock: product.stock,
          min_stock: product.min_stock,
          max_stock: product.max_stock,
          status,
          priority,
        });
      } else {
        for (const variant of product.variants) {
          const vMin = variant.min_stock ?? product.min_stock ?? 0;
          const vMax = variant.max_stock ?? product.max_stock ?? 999999;

          if (variant.stock <= vMin || variant.stock > vMax) {
            let status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OVER_STOCK' =
              'LOW_STOCK';
            let priority = 2;

            if (variant.stock <= 0) {
              status = 'OUT_OF_STOCK';
              priority = 1;
            } else if (variant.stock > vMax) {
              status = 'OVER_STOCK';
              priority = 3;
            }

            alerts.push({
              product_id: product._id.toString(),
              sku: variant.sku,
              name: `${product.name} - ${variant.sku}`,
              thumbnail: product.thumbnail || '',
              current_stock: variant.stock,
              min_stock: vMin,
              max_stock: vMax,
              status,
              priority,
            });
          }
        }
      }
    }

    alerts.sort((a, b) => a.priority - b.priority);
    return alerts.slice(0, 20);
  }

  // XỬ LÝ NGÀY THÁNG
  private getDateRanges(filter: DashboardFilterDto): {
    start: Date;
    end: Date;
    prevStart: Date;
    prevEnd: Date;
  } {
    let start = filter.start_date ? new Date(filter.start_date) : new Date();
    const end = filter.end_date ? new Date(filter.end_date) : new Date();
    let prevStart = new Date();
    let prevEnd = new Date();

    if (!filter.time_filter && !filter.start_date && !filter.end_date) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      prevStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
      prevEnd = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      return { start, end, prevStart, prevEnd };
    }

    if (filter.time_filter === TimeFilter.TODAY) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      prevStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
      prevEnd = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    } else if (filter.time_filter === TimeFilter.THIS_WEEK) {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      prevStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
      prevEnd = new Date(start.getTime() - 1);
    } else if (filter.time_filter === TimeFilter.THIS_MONTH) {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
      prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
      prevEnd = new Date(
        start.getFullYear(),
        start.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );
    } else if (filter.time_filter === TimeFilter.THIS_YEAR) {
      start = new Date(end.getFullYear(), 0, 1);
      prevStart = new Date(start.getFullYear() - 1, 0, 1);
      prevEnd = new Date(start.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    } else if (filter.start_date && filter.end_date) {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - diffTime);
    }

    return { start, end, prevStart, prevEnd };
  }

  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(2));
  }

  // DOANH THU & ĐƠN HÀNG
  async getOverviewStats(filter: DashboardFilterDto): Promise<OverviewMetrics> {
    const { start, end, prevStart, prevEnd } = this.getDateRanges(filter);
    const validStatuses = {
      $nin: ['CANCELLED', 'RETURNED', 'DELIVERY_FAILED', 'REFUNDED'],
    };

    // Thực thi toàn bộ truy vấn song song để tối ưu hiệu suất đọc
    const [
      currentStats,
      prevStats,
      chartRaw,
      pipelineStats,
      returnStats,
      recentTickets,
      openTicketsCount,
      metricsCount,
      integrationErrors,
      inventoryBatches, // Biến hứng dữ liệu thứ 10
    ] = await Promise.all([
      this.orderModel.aggregate<RawAggregationResult & { total_items: number }>(
        [
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
              status: validStatuses,
            },
          },
          {
            $group: {
              _id: null,
              total_revenue: { $sum: '$total_amount' },
              total_orders: { $sum: 1 },
              total_items: { $sum: { $sum: '$items.quantity' } },
            },
          },
        ],
      ),
      this.orderModel.aggregate<RawAggregationResult & { total_items: number }>(
        [
          {
            $match: {
              createdAt: { $gte: prevStart, $lte: prevEnd },
              status: validStatuses,
            },
          },
          {
            $group: {
              _id: null,
              total_revenue: { $sum: '$total_amount' },
              total_orders: { $sum: 1 },
              total_items: { $sum: { $sum: '$items.quantity' } },
            },
          },
        ],
      ),
      this.orderModel.aggregate<ChartRawData>([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            status: validStatuses,
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$total_amount' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.orderModel.aggregate<{ _id: string; count: number }>([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Lấy các yêu cầu bảo hành gần nhất để làm return_stats
      this.warrantyClaimModel
        .find({ createdAt: { $gte: start, $lte: end } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('claim_code status')
        .lean<Array<{ claim_code: string; status: string }>>(),
      // Lấy lịch sử vé chat hỗ trợ
      this.conversationModel
        .find({ createdAt: { $gte: start, $lte: end } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id status')
        .lean<Array<{ _id: Types.ObjectId; status: string }>>(),
      this.conversationModel.countDocuments({
        status: ConversationStatus.OPEN,
        createdAt: { $gte: start, $lte: end },
      }),
      // Kiểm tra sức khỏe hệ thống dựa vào lỗi 5xx
      this.systemMetricModel.countDocuments({
        createdAt: { $gte: start, $lte: end },
        status_code: { $gte: 500 },
      }),
      // Kiểm tra sức khỏe hệ thống đối tác thứ 3
      this.integrationLogModel.countDocuments({
        createdAt: { $gte: start, $lte: end },
        is_error: true,
      }),
      // [BỔ SUNG THỨ 10]: Lấy danh sách lô hàng chuẩn bị xuất (Ready for Pick/Pack Batches)
      this.stockTransactionModel
        .find({ action_type: 'EXPORT', status: 'PROCESSING' })
        .sort({ created_at: -1 })
        .limit(4)
        .select('transaction_code')
        .lean<Array<{ transaction_code: string }>>(),
    ]);

    const current = currentStats[0] || {
      total_revenue: 0,
      total_orders: 0,
      total_items: 0,
    };
    const prev = prevStats[0] || {
      total_revenue: 0,
      total_orders: 0,
      total_items: 0,
    };

    const chart_data = chartRaw.map((item) => ({
      label: String(item._id),
      revenue: Number(item.revenue),
      orders: Number(item.orders),
    }));

    // Gắn logic hệ thống thực tế vào widget Live Activity
    const system_activities: SystemStageStat[] = [
      {
        id: 'stage-1',
        type: 'server',
        title: 'Server Info',
        desc: metricsCount > 5 ? 'High Server Errors' : 'API Gateway Connected',
        status: metricsCount > 5 ? 'offline' : 'active',
      },
      {
        id: 'stage-2',
        type: 'order',
        title: 'Order',
        desc:
          integrationErrors > 5
            ? 'Integration Issues'
            : 'Order Processing Online',
        status: integrationErrors > 5 ? 'offline' : 'active',
      },
      {
        id: 'stage-3',
        type: 'announcement',
        title: 'Announcement',
        desc: 'System Optimal',
        status: 'active',
      },
      {
        id: 'stage-4',
        type: 'alert',
        title: 'Alert',
        desc: 'Security Monitoring Active',
        status: 'active',
      },
    ];

    return {
      net_revenue: current.total_revenue,
      total_orders: current.total_orders,
      total_items: current.total_items,
      prev_net_revenue: prev.total_revenue,
      prev_total_orders: prev.total_orders,
      revenue_growth_percent: this.calculateGrowth(
        current.total_revenue,
        prev.total_revenue,
      ),
      orders_growth_percent: this.calculateGrowth(
        current.total_orders,
        prev.total_orders,
      ),
      items_growth_percent: this.calculateGrowth(
        current.total_items,
        prev.total_items,
      ),
      chart_data: chart_data || [],
      pipeline_stats: pipelineStats || [],
      return_stats: returnStats.map((r) => ({
        claim_code: r.claim_code,
        status: r.status,
      })),
      recent_tickets: recentTickets.map((t) => ({
        id: String(t._id).substring(0, 8),
        status: t.status,
      })),
      open_tickets_count: openTicketsCount,
      system_activities,
      // [BỔ SUNG ĐẦU RA]: Map mảng object thành mảng string các mã transaction
      inventory_batches: inventoryBatches.map((b) => b.transaction_code),
    };
  }

  // SẢN PHẨM BÁN CHẠY
  async getTopProducts(filter: TopEntityFilterDto): Promise<TopProduct[]> {
    const { start, end, prevStart, prevEnd } = this.getDateRanges(filter);
    const validStatuses = {
      $nin: ['CANCELLED', 'RETURNED', 'DELIVERY_FAILED', 'REFUNDED'],
    };

    const sortDirection = filter.sort_order === SortOrder.ASC ? 1 : -1;
    const sortField =
      filter.sort_by === SortBy.REVENUE ? 'total_revenue' : 'total_quantity';

    const currentResults = await this.orderModel.aggregate<RawTopProductData>([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: validStatuses,
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product_id',
          total_revenue: {
            $sum: { $multiply: ['$items.price', '$items.quantity'] },
          },
          total_quantity: { $sum: '$items.quantity' },
          raw_variants: {
            $push: {
              sku: '$items.sku',
              variant_name: '$items.variant_name',
              quantity: '$items.quantity',
              revenue: { $multiply: ['$items.price', '$items.quantity'] },
            },
          },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product_info',
        },
      },
      { $unwind: '$product_info' },
      ...(filter.category_id
        ? [
            {
              $match: {
                'product_info.categories': new Types.ObjectId(
                  filter.category_id,
                ),
              },
            },
          ]
        : []),
      { $sort: { [sortField]: sortDirection } },
      { $limit: 10 },
    ]);

    if (currentResults.length === 0) return [];

    const productIds = currentResults.map((p) => p._id);
    const prevResults = await this.orderModel.aggregate<PrevEntityStat>([
      {
        $match: {
          createdAt: { $gte: prevStart, $lte: prevEnd },
          status: validStatuses,
        },
      },
      { $unwind: '$items' },
      { $match: { 'items.product_id': { $in: productIds } } },
      {
        $group: {
          _id: '$items.product_id',
          total_revenue: {
            $sum: { $multiply: ['$items.price', '$items.quantity'] },
          },
          total_quantity: { $sum: '$items.quantity' },
        },
      },
    ]);

    const prevMap = new Map<string, PrevEntityStat>();
    prevResults.forEach((p) => prevMap.set(p._id.toString(), p));

    return currentResults.map((item) => {
      const variantMap = new Map<string, VariantContribution>();

      item.raw_variants.forEach((v) => {
        if (variantMap.has(v.sku)) {
          const existing = variantMap.get(v.sku)!;
          existing.quantity += v.quantity;
          existing.revenue += v.revenue;
        } else {
          variantMap.set(v.sku, {
            sku: v.sku,
            variant_name: v.variant_name || 'Default', // FIX Tiếng Việt -> Tiếng Anh
            quantity: v.quantity,
            revenue: v.revenue,
            contribution_percent: 0,
          });
        }
      });

      const variants = Array.from(variantMap.values()).map((v) => ({
        ...v,
        contribution_percent: Number(
          ((v.revenue / item.total_revenue) * 100).toFixed(2),
        ),
      }));

      const prevStat = prevMap.get(item._id.toString());
      const growthMetric =
        filter.sort_by === SortBy.REVENUE
          ? this.calculateGrowth(
              item.total_revenue,
              prevStat?.total_revenue || 0,
            )
          : this.calculateGrowth(
              item.total_quantity,
              prevStat?.total_quantity || 0,
            );

      return {
        product_id: String(item._id),
        name: String(item.product_info.name),
        image: String(item.product_info.thumbnail || ''),
        total_quantity: Number(item.total_quantity),
        total_revenue: Number(item.total_revenue),
        growth_percent: growthMetric,
        variants,
      };
    });
  }

  // DANH MỤC BÁN CHẠY
  async getTopCategories(filter: TopEntityFilterDto): Promise<TopCategory[]> {
    const { start, end, prevStart, prevEnd } = this.getDateRanges(filter);

    const sortDirection = filter.sort_order === SortOrder.ASC ? 1 : -1;
    const sortField =
      filter.sort_by === SortBy.REVENUE ? 'total_revenue' : 'total_quantity';

    const baseMatch: Record<string, unknown> = {
      createdAt: { $gte: start, $lte: end },
    };

    const categoriesStats = await this.orderModel.aggregate<RawTopCategoryData>(
      [
        { $match: baseMatch },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        { $unwind: '$product.categories' },
        {
          $lookup: {
            from: 'categories',
            localField: 'product.categories',
            foreignField: '_id',
            as: 'cat_detail',
          },
        },
        { $unwind: '$cat_detail' },
        {
          $addFields: {
            root_category_id: {
              $ifNull: [
                { $arrayElemAt: ['$cat_detail.ancestors._id', 0] },
                '$cat_detail._id',
              ],
            },
          },
        },
        ...(filter.category_id &&
        filter.category_id.trim() !== '' &&
        Types.ObjectId.isValid(filter.category_id)
          ? [
              {
                $match: {
                  'product.categories': new Types.ObjectId(filter.category_id),
                },
              },
            ]
          : []),
        {
          $group: {
            _id: '$root_category_id',
            total_revenue: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$status',
                      ['CANCELLED', 'RETURNED', 'DELIVERY_FAILED', 'REFUNDED'],
                    ],
                  },
                  0,
                  { $multiply: ['$items.price', '$items.quantity'] },
                ],
              },
            },
            total_quantity: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$status',
                      ['CANCELLED', 'RETURNED', 'DELIVERY_FAILED', 'REFUNDED'],
                    ],
                  },
                  0,
                  '$items.quantity',
                ],
              },
            },
            returned_quantity: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['RETURNED', 'REFUNDED']] },
                  '$items.quantity',
                  0,
                ],
              },
            },
            total_ordered_quantity: { $sum: '$items.quantity' },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category_info',
          },
        },
        { $unwind: '$category_info' },
        { $sort: { [sortField]: sortDirection } },
      ],
    );

    if (categoriesStats.length === 0) return [];

    const totalPlatformRevenue = categoriesStats.reduce(
      (sum, cat) => sum + cat.total_revenue,
      0,
    );
    const categoryIds = categoriesStats.map((c) => c._id);

    const prevCategoriesStats = await this.orderModel.aggregate<PrevEntityStat>(
      [
        { $match: { createdAt: { $gte: prevStart, $lte: prevEnd } } },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        { $unwind: '$product.categories' },
        { $match: { 'product.categories': { $in: categoryIds } } },
        {
          $group: {
            _id: '$product.categories',
            total_revenue: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$status',
                      ['CANCELLED', 'RETURNED', 'DELIVERY_FAILED', 'REFUNDED'],
                    ],
                  },
                  0,
                  { $multiply: ['$items.price', '$items.quantity'] },
                ],
              },
            },
            total_quantity: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$status',
                      ['CANCELLED', 'RETURNED', 'DELIVERY_FAILED', 'REFUNDED'],
                    ],
                  },
                  0,
                  '$items.quantity',
                ],
              },
            },
          },
        },
      ],
    );

    const prevMap = new Map<string, PrevEntityStat>();
    prevCategoriesStats.forEach((p) => prevMap.set(p._id.toString(), p));

    return categoriesStats.map((cat) => {
      const prevStat = prevMap.get(cat._id.toString());
      const growthMetric =
        filter.sort_by === SortBy.REVENUE
          ? this.calculateGrowth(
              cat.total_revenue,
              prevStat?.total_revenue || 0,
            )
          : this.calculateGrowth(
              cat.total_quantity,
              prevStat?.total_quantity || 0,
            );

      return {
        category_id: String(cat._id),
        name: String(cat.category_info.name),
        total_revenue: Number(cat.total_revenue),
        total_quantity: Number(cat.total_quantity),
        revenue_contribution_percent:
          totalPlatformRevenue === 0
            ? 0
            : Number(
                ((cat.total_revenue / totalPlatformRevenue) * 100).toFixed(2),
              ),
        return_rate_percent:
          cat.total_ordered_quantity === 0
            ? 0
            : Number(
                (
                  (cat.returned_quantity / cat.total_ordered_quantity) *
                  100
                ).toFixed(2),
              ),
        growth_percent: growthMetric,
      };
    });
  }

  // LẤY DANH SÁCH ĐƠN HÀNG GẦN NHẤT
  async getRecentOrders(limit: number = 10) {
    const recentOrders = await this.orderModel
      .find({ status: { $nin: ['CANCELLED', 'REFUNDED'] } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('order_code shipping_info.name total_amount status createdAt')
      .lean();

    return recentOrders.map((order) => ({
      order_code: order.order_code,
      customer_name: order.shipping_info?.name || 'Guest', // FIX Tiếng Việt -> Tiếng Anh
      total_amount: order.total_amount,
      status: order.status,
      created_at: order.createdAt,
    }));
  }

  // LẤY INVENTORY KPIs
  async getInventoryKPIs(): Promise<InventoryKPI[]> {
    const products = await this.productModel
      .find({ is_deleted: false, status: 'ACTIVE' })
      .select('stock has_variants variants min_stock base_price')
      .lean();

    let totalValue = 0;
    let totalItems = 0;
    let lowStockCount = 0;
    let totalSkus = 0; // Thêm biến đếm tổng số lượng SKU

    for (const product of products) {
      const productObj = product as unknown as { base_price?: number };
      const basePrice = productObj.base_price || 50;

      if (product.has_variants && Array.isArray(product.variants)) {
        for (const variant of product.variants) {
          totalSkus++; // Tăng đếm cho mỗi biến thể (1 SKU)
          const vStock = Number(variant.stock) || 0;
          const vObj = variant as unknown as { price?: number };
          const variantPrice = vObj.price || basePrice;

          totalItems += vStock;
          totalValue += vStock * variantPrice;

          const vMin = variant.min_stock ?? product.min_stock ?? 0;
          if (vStock <= vMin) lowStockCount++;
        }
      } else {
        totalSkus++; // Tăng đếm cho sản phẩm không có biến thể (1 SKU)
        const pStock = Number(product.stock) || 0;
        totalItems += pStock;
        totalValue += pStock * basePrice;

        const pMin = product.min_stock ?? 0;
        if (pStock <= pMin) lowStockCount++;
      }
    }

    const turnoverRatio = 4.2;

    return [
      {
        title: 'Total Stock Value',
        value: `$${(totalValue / 1000000).toFixed(2)}M`,
        subtext: 'Across all warehouses',
        iconType: 'dollar',
      },
      {
        title: 'Total Items in Stock',
        value: totalItems.toLocaleString('en-US'),
        subtext: 'Across all warehouses',
        iconType: 'box',
      },
      {
        title: 'Low Stock Items',
        value: lowStockCount.toString(),
        subtext: 'Requires immediate attention',
        iconType: 'truck',
      },
      {
        title: 'Inventory Turnover',
        value: turnoverRatio.toFixed(1),
        subtext: 'Target: 5.0',
        iconType: 'refresh',
      },
      // Object ngầm cung cấp dữ liệu tổng SKU cho Frontend tính toán tỷ lệ phần trăm
      {
        title: 'Total SKUs',
        value: totalSkus.toString(),
        subtext: '',
        iconType: 'box',
      },
    ];
  }
}
