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
  SortOrder,
  TimeFilter,
} from 'src/common/dtos/dashboard-filter.dto';
import { getReportDateRange } from 'src/common/utils/date-range.util';
import { NON_REVENUE_ORDER_STATUSES } from 'src/common/constants/order-status.constant';

import {
  StockAlertItem,
  OverviewMetrics,
  TopCategory,
  TopProduct,
  VariantContribution,
  SystemStageStat,
  ChatbotSalesReport,
} from 'src/common/interfaces/dashboard.interface';
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
  Conversation,
  ConversationDocument,
  ConversationStatus,
} from 'src/modules/support/chat/schemas/conversation.schema';
import {
  StockTransaction,
  StockTransactionDocument,
} from 'src/modules/inventory/transactions/schemas/stock-transaction.schema';
import {
  classifyStock,
  resolveThresholds,
  type StockAlertStatus,
} from 'src/common/utils/stock-status.util';
import { Message } from 'src/modules/support/chat/schemas/message.schema';

interface RawAggregationResult {
  total_revenue: number;
  total_orders: number;
}

interface ChartRawData {
  _id: string | number; // "YYYY-MM-DD" khi gom theo ngày, 0–23 khi gom theo giờ
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
    @InjectModel(Message.name)
    private readonly messageModel: Model<Message>,
    @InjectModel(WarrantyClaim.name)
    private readonly warrantyClaimModel: Model<WarrantyClaimDocument>,
    @InjectModel(SystemMetric.name)
    private readonly systemMetricModel: Model<SystemMetricDocument>,
    @InjectModel(IntegrationLog.name)
    private readonly integrationLogModel: Model<IntegrationLogDocument>,
    @InjectModel(StockTransaction.name)
    private readonly stockTransactionModel: Model<StockTransactionDocument>,
  ) {}

  // WIDGET CẢNH BÁO TỒN KHO — dùng chung luật với trang Inventory Management
  // (trước đây max_stock mặc định 0 → mọi SKU còn hàng bị coi là Overstock)
  async getStockAlertsWidget(): Promise<StockAlertItem[]> {
    const products = await this.productModel
      .find({ is_deleted: false })
      .select(
        'name sku thumbnail stock min_stock max_stock has_variants variants',
      )
      .lean();

    const PRIORITY: Record<StockAlertStatus, number> = {
      OUT_OF_STOCK: 1,
      LOW_STOCK: 2,
      OVER_STOCK: 3,
    };
    const alerts: StockAlertItem[] = [];

    for (const product of products) {
      // Gom về cùng một dạng: mỗi biến thể là 1 SKU, sản phẩm đơn là 1 SKU
      const entries =
        product.has_variants &&
        Array.isArray(product.variants) &&
        product.variants.length > 0
          ? product.variants.map((v) => ({
              sku: v.sku,
              name: `${product.name} - ${v.sku}`,
              stock: Number(v.stock) || 0,
              ...resolveThresholds(v, product),
            }))
          : [
              {
                sku: product.sku,
                name: product.name,
                stock: Number(product.stock) || 0,
                ...resolveThresholds(null, product),
              },
            ];

      for (const e of entries) {
        const status = classifyStock(e.stock, e.min, e.max);
        if (!status) continue;

        alerts.push({
          product_id: String(product._id),
          sku: e.sku,
          name: e.name,
          thumbnail: product.thumbnail || '',
          current_stock: e.stock,
          min_stock: e.min,
          max_stock: e.max ?? 0, // 0 = không giới hạn tồn tối đa
          status,
          priority: PRIORITY[status],
        });
      }
    }

    // Hết hàng → sắp hết (tồn thấp nhất trước) → tồn vượt
    alerts.sort(
      (a, b) => a.priority - b.priority || a.current_stock - b.current_stock,
    );
    return alerts.slice(0, 20);
  }

  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(2));
  }

  // DOANH THU & ĐƠN HÀNG
  async getOverviewStats(filter: DashboardFilterDto): Promise<OverviewMetrics> {
    const { start, end, prevStart, prevEnd } = getReportDateRange(filter);
    const validStatuses = { $nin: NON_REVENUE_ORDER_STATUSES };

    // US.87 AC1: Hôm nay → gom theo từng khung giờ; các kỳ khác → gom theo ngày (giờ VN)
    const isHourlyChart =
      (filter.time_filter ?? TimeFilter.TODAY) === TimeFilter.TODAY;
    const chartGroupId = isHourlyChart
      ? { $hour: { date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' } }
      : {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt',
            timezone: 'Asia/Ho_Chi_Minh',
          },
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
            _id: chartGroupId,
            revenue: { $sum: '$total_amount' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Không tính đơn tạm (TEMPORARY = phiên giữ hàng, chưa phải đơn thật)
      this.orderModel.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            status: { $ne: 'TEMPORARY' },
          },
        },
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
      // Tồn đọng thực tế: mọi ticket đang mở, không chỉ ticket tạo trong kỳ
      this.conversationModel.countDocuments({
        status: ConversationStatus.OPEN,
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
      label:
        typeof item._id === 'number'
          ? `${String(item._id).padStart(2, '0')}:00`
          : String(item._id),
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

  // DOANH THU TỪ CHATBOT — cùng luật doanh thu với getOverviewStats để chatbot + web = Total Revenue
  async getChatbotSales(
    filter: DashboardFilterDto,
  ): Promise<ChatbotSalesReport> {
    const { start, end, prevStart, prevEnd } = getReportDateRange(filter);
    const validStatuses = { $nin: NON_REVENUE_ORDER_STATUSES };
    const isChatbot = { sales_channel: 'CHATBOT' };

    const isHourlyChart =
      (filter.time_filter ?? TimeFilter.TODAY) === TimeFilter.TODAY;
    const chartGroupId = isHourlyChart
      ? { $hour: { date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' } }
      : {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt',
            timezone: 'Asia/Ho_Chi_Minh',
          },
        };

    interface ChannelAgg {
      _id: string;
      revenue: number;
      orders: number;
    }
    interface TopAgg {
      _id: Types.ObjectId;
      name: string;
      quantity: number;
      revenue: number;
    }
    interface FacetResult {
      byChannel: ChannelAgg[];
      chart: ChartRawData[];
      topProducts: TopAgg[];
      converted: { count: number }[];
    }

    const [facetRaw, prevRaw, suggestionRaw] = await Promise.all([
      this.orderModel.aggregate<FacetResult>([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            status: validStatuses,
          },
        },
        {
          $facet: {
            // Đơn cũ (trước khi có sales_channel) tính là WEB
            byChannel: [
              {
                $group: {
                  _id: { $ifNull: ['$sales_channel', 'WEB'] },
                  revenue: { $sum: '$total_amount' },
                  orders: { $sum: 1 },
                },
              },
            ],
            chart: [
              { $match: isChatbot },
              {
                $group: {
                  _id: chartGroupId,
                  revenue: { $sum: '$total_amount' },
                  orders: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
            topProducts: [
              { $match: isChatbot },
              { $unwind: '$items' },
              {
                $group: {
                  _id: '$items.product_id',
                  name: { $first: '$items.product_name' },
                  quantity: { $sum: '$items.quantity' },
                  revenue: {
                    $sum: { $multiply: ['$items.price', '$items.quantity'] },
                  },
                },
              },
              { $sort: { revenue: -1 } },
              { $limit: 5 },
            ],
            converted: [
              {
                $match: {
                  ...isChatbot,
                  'chatbot_ref.conversation_id': { $exists: true },
                },
              },
              { $group: { _id: '$chatbot_ref.conversation_id' } },
              { $count: 'count' },
            ],
          },
        },
      ]),
      this.orderModel.aggregate<{ _id: null; revenue: number }>([
        {
          $match: {
            createdAt: { $gte: prevStart, $lte: prevEnd },
            status: validStatuses,
            ...isChatbot,
          },
        },
        { $group: { _id: null, revenue: { $sum: '$total_amount' } } },
      ]),
      // Mẫu số tỷ lệ chuyển đổi: hội thoại có ít nhất 1 thẻ sản phẩm trong kỳ
      this.messageModel.aggregate<{ count: number }>([
        {
          $match: {
            sender_type: 'BOT',
            message_type: 'PRODUCT_CARD',
            createdAt: { $gte: start, $lte: end },
          },
        },
        { $group: { _id: '$conversation_id' } },
        { $count: 'count' },
      ]),
    ]);

    const facet = facetRaw[0] ?? {
      byChannel: [],
      chart: [],
      topProducts: [],
      converted: [],
    };
    const chatbot = facet.byChannel.find((c) => c._id === 'CHATBOT') ?? {
      revenue: 0,
      orders: 0,
    };
    const totalRevenue = facet.byChannel.reduce((s, c) => s + c.revenue, 0);
    const totalOrders = facet.byChannel.reduce((s, c) => s + c.orders, 0);
    const webRevenue = totalRevenue - chatbot.revenue;
    const webOrders = totalOrders - chatbot.orders;
    const prevChatbotRevenue = prevRaw[0]?.revenue ?? 0;
    const suggestionConversations = suggestionRaw[0]?.count ?? 0;
    const convertedConversations = facet.converted[0]?.count ?? 0;

    const pct = (part: number, whole: number) =>
      whole > 0 ? Number(((part / whole) * 100).toFixed(2)) : 0;
    const avg = (sum: number, count: number) =>
      count > 0 ? Number((sum / count).toFixed(2)) : 0;

    return {
      chatbot_revenue: chatbot.revenue,
      chatbot_orders: chatbot.orders,
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      revenue_share_percent: pct(chatbot.revenue, totalRevenue),
      orders_share_percent: pct(chatbot.orders, totalOrders),
      chatbot_aov: avg(chatbot.revenue, chatbot.orders),
      web_aov: avg(webRevenue, webOrders),
      prev_chatbot_revenue: prevChatbotRevenue,
      revenue_growth_percent: this.calculateGrowth(
        chatbot.revenue,
        prevChatbotRevenue,
      ),
      suggestion_conversations: suggestionConversations,
      converted_conversations: convertedConversations,
      // Đơn trong kỳ có thể đến từ thẻ gửi cuối kỳ trước -> chặn trần 100%
      conversion_rate_percent: Math.min(
        100,
        pct(convertedConversations, suggestionConversations),
      ),
      chart_data: facet.chart.map((item) => ({
        label:
          typeof item._id === 'number'
            ? `${String(item._id).padStart(2, '0')}:00`
            : String(item._id),
        revenue: Number(item.revenue),
        orders: Number(item.orders),
      })),
      top_products: facet.topProducts.map((p) => ({
        product_id: String(p._id),
        name: p.name,
        quantity: Number(p.quantity),
        revenue: Number(Number(p.revenue).toFixed(2)),
      })),
    };
  }

  // SẢN PHẨM BÁN CHẠY
  async getTopProducts(filter: TopEntityFilterDto): Promise<TopProduct[]> {
    const { start, end, prevStart, prevEnd } = getReportDateRange(filter);
    const validStatuses = { $nin: NON_REVENUE_ORDER_STATUSES };

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
    const { start, end, prevStart, prevEnd } = getReportDateRange(filter);

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
                  { $in: ['$status', NON_REVENUE_ORDER_STATUSES] },
                  0,
                  { $multiply: ['$items.price', '$items.quantity'] },
                ],
              },
            },
            total_quantity: {
              $sum: {
                $cond: [
                  { $in: ['$status', NON_REVENUE_ORDER_STATUSES] },
                  0,
                  '$items.quantity',
                ],
              },
            },
            // Tỷ lệ hoàn trả: giữ nguyên danh sách riêng, khác mục đích với doanh thu
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
                  { $in: ['$status', NON_REVENUE_ORDER_STATUSES] },
                  0,
                  { $multiply: ['$items.price', '$items.quantity'] },
                ],
              },
            },
            total_quantity: {
              $sum: {
                $cond: [
                  { $in: ['$status', NON_REVENUE_ORDER_STATUSES] },
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

  // LẤY INVENTORY KPIs — dùng chung luật Low Stock với trang Inventory Management
  async getInventoryKPIs(): Promise<InventoryKPI[]> {
    // Tồn kho vật lý không phụ thuộc trạng thái mở bán → chỉ loại sản phẩm đã xóa
    // (trước đây lọc status ACTIVE nên số liệu lệch với trang Inventory Management)
    const products = await this.productModel
      .find({ is_deleted: false })
      .select('stock has_variants variants min_stock max_stock price')
      .lean();

    let totalValue = 0;
    let totalItems = 0;
    let lowStockCount = 0;
    let totalSkus = 0;

    for (const product of products) {
      // Schema Product dùng field `price` (trước đây đọc `base_price` không tồn tại → luôn $50)
      const productPrice = Number(product.price) || 0;

      if (
        product.has_variants &&
        Array.isArray(product.variants) &&
        product.variants.length > 0
      ) {
        for (const variant of product.variants) {
          totalSkus++;
          const vStock = Number(variant.stock) || 0;
          const variantPrice = Number(variant.price) || productPrice;

          totalItems += vStock;
          totalValue += vStock * variantPrice;

          // Ngưỡng min: biến thể → sản phẩm cha → DEFAULT_MIN_STOCK (10)
          const { min: vMin } = resolveThresholds(variant, product);
          if (vStock <= vMin) lowStockCount++;
        }
      } else {
        totalSkus++;
        const pStock = Number(product.stock) || 0;
        totalItems += pStock;
        totalValue += pStock * productPrice;

        const { min: pMin } = resolveThresholds(null, product);
        if (pStock <= pMin) lowStockCount++;
      }
    }

    // "$14.2K", "$1.35M" thay vì "$0.01M" khi tổng giá trị nhỏ
    const formatCompactUsd = (v: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 2,
      }).format(v);

    return [
      {
        title: 'Total Stock Value',
        value: formatCompactUsd(totalValue),
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
      // Object ngầm cung cấp tổng SKU cho Overview tính tỷ lệ phần trăm
      {
        title: 'Total SKUs',
        value: totalSkus.toString(),
        subtext: '',
        iconType: 'box',
      },
    ];
  }
}
