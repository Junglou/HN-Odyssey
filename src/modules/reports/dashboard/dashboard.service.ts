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
  ChartDataPoint,
  OverviewMetrics,
  TopCategory,
  TopProduct,
  VariantContribution,
} from 'src/common/interfaces/dashboard.interface';

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

    const [currentStats, prevStats, chartRaw] = await Promise.all([
      this.orderModel.aggregate<RawAggregationResult>([
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
          },
        },
      ]),
      this.orderModel.aggregate<RawAggregationResult>([
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
          },
        },
      ]),
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
    ]);

    const current = currentStats[0] || { total_revenue: 0, total_orders: 0 };
    const prev = prevStats[0] || { total_revenue: 0, total_orders: 0 };

    const chart_data: ChartDataPoint[] = chartRaw.map((item) => ({
      label: String(item._id),
      revenue: Number(item.revenue),
      orders: Number(item.orders),
    }));

    return {
      net_revenue: current.total_revenue,
      total_orders: current.total_orders,
      revenue_growth_percent: this.calculateGrowth(
        current.total_revenue,
        prev.total_revenue,
      ),
      orders_growth_percent: this.calculateGrowth(
        current.total_orders,
        prev.total_orders,
      ),
      chart_data: chart_data || [],
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
            variant_name: v.variant_name || 'Mặc định',
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
        // BƯỚC 1: Lấy thông tin danh mục để tìm danh mục gốc (US3-AC1)
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
            // Lấy ID của danh mục cấp 1 (phần tử đầu tiên trong ancestors)
            root_category_id: {
              $ifNull: [
                { $arrayElemAt: ['$cat_detail.ancestors._id', 0] },
                '$cat_detail._id',
              ],
            },
          },
        },
        // BƯỚC 2: Drill-down filter (Nếu người dùng lọc xem một danh mục cụ thể)
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
        // BƯỚC 3: Gom nhóm theo Danh mục gốc và tính toán (US3-AC1, AC7)
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
                // Bao gồm cả đơn đã hoàn tiền (REFUNDED) vào tỷ lệ trả hàng
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
        // BƯỚC 4: Lấy tên danh mục để hiển thị
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

    // Tính toán kỳ trước để so sánh tăng trưởng (US3-AC6)
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
}
