import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Model,
  Types,
  ClientSession,
  FilterQuery,
  UpdateQuery,
  isValidObjectId,
  PipelineStage,
} from 'mongoose';

import { AdjustStockDto } from './dto/adjust-stock.dto';
import { GetStockDto } from './dto/get-stock.dto';
import { ManualAdjustDto } from './dto/manual-adjust.dto';
import { AcceptOrderDto } from './dto/accept-order.dto';

import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import {
  StockTransaction,
  StockTransactionDocument,
} from '../transactions/schemas/stock-transaction.schema';

import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReportIssueDto } from './dto/report-issue.dto';
import { UpdateThresholdsDto } from './dto/update-thresholds.dto';
import { StockGateway } from './stock.gateway';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Resource } from 'src/common/enums/resource.enum';
import { Department } from 'src/common/enums/department.enum';
import { SYSTEM_CONSTANTS } from 'src/common/constants/system.constant';
import {
  GetPendingRequestsDto,
  RequestFilterStatus,
  RequestFilterType,
} from './dto/get-pending-requests.dto';

interface VariantStockInfo {
  sku: string;
  stock: number;
  min_stock: number;
  max_stock: number;
}

interface ProductAlertDoc {
  _id: Types.ObjectId | string;
  name?: string;
  warehouse_id?: Types.ObjectId | string;
  has_variants?: boolean;
  variants?: Array<{
    sku: string;
    stock: number;
    min_stock: number;
    max_stock: number;
  }>;
  stock?: number;
  min_stock?: number;
  max_stock?: number;
}

// Định nghĩa Interface cho kết quả trả về từ DB
interface StockVariantData {
  sku: string;
  stock: number;
  stock_on_hold?: number;
  min_stock?: number;
  max_stock?: number;
}

interface StockProductData {
  _id: unknown;
  sku: string;
  name: string;
  thumbnail: string;
  stock: number;
  stock_on_hold?: number; // Cần thiết để tính Available
  min_stock: number;
  max_stock?: number;
  has_variants: boolean;
  variants?: StockVariantData[];
  category_info?: Array<{ name: string }>; // Kết quả từ $lookup
  warehouse_info?: Array<{ name: string; code?: string }>; // Kết quả từ $lookup
}

interface AggregationResult {
  data: StockProductData[];
  total: { count: number }[];
}

export interface PopulatedOrderProduct {
  _id: Types.ObjectId;
  name: string;
}

export interface PopulatedOrderItem {
  product_id: PopulatedOrderProduct | Types.ObjectId | null;
  sku: string;
  product_name: string;
  quantity: number;
}

export interface OrderTimelineItem {
  status: string;
  timestamp: Date;
  actor: string;
  note?: string;
}

export interface PopulatedOrder {
  _id: Types.ObjectId;
  order_code: string;
  status: string;
  createdAt?: Date;
  created_at?: Date;
  items: PopulatedOrderItem[];
  timeline?: OrderTimelineItem[];
}

export interface RequestItemOutput {
  sku: string;
  productName: string;
  quantity: number;
}

export interface RequestDataOutput {
  id: string;
  requestCode: string;
  type: 'import' | 'export';
  source: 'Sales' | 'Purchasing';
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date | string;
  items: RequestItemOutput[];
  note: string;
}

@Injectable()
export class StockService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(StockTransaction.name)
    private transactionModel: Model<StockTransactionDocument>,
    private readonly eventEmitter: EventEmitter2,
    private readonly stockGateway: StockGateway,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // [US1] HIỂN THỊ DANH SÁCH TỒN KHO
  async getStockList(queryDto: GetStockDto) {
    const {
      search,
      status,
      category,
      sort_by,
      sort_order,
      page = 1,
      limit = 10,
    } = queryDto as GetStockDto & { page?: number; limit?: number };

    // Định nghĩa Interface cho MatchStage
    interface MatchStage {
      is_deleted: boolean;
      $or?: Record<string, unknown>[];
    }

    // 1. Pipeline bắt đầu bằng các điều kiện cơ bản
    const matchStage: MatchStage = { is_deleted: false };

    if (search) {
      matchStage.$or = [
        { sku: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { 'variants.sku': { $regex: search, $options: 'i' } },
      ];
    }

    const pipeline: PipelineStage[] = [
      { $match: matchStage as FilterQuery<ProductDocument> },
    ];

    // 2. JOIN BẢNG ĐỂ LẤY CATEGORY VÀ WAREHOUSE (LOCATION)
    pipeline.push(
      {
        $lookup: {
          from: 'categories', // Tên collection (thường là số nhiều viết thường)
          localField: 'categories',
          foreignField: '_id',
          as: 'category_info',
        },
      } as PipelineStage.Lookup,
      {
        $lookup: {
          from: 'warehouses', // Tên collection của Warehouse
          localField: 'warehouse_id',
          foreignField: '_id',
          as: 'warehouse_info',
        },
      } as PipelineStage.Lookup,
    );

    // Lọc theo category slug (nếu FE có truyền lên)
    if (category && category !== 'all') {
      pipeline.push({
        $match: {
          'category_info.slug': category,
        },
      });
    }

    // 3. LOGIC TÍNH STATUS NHƯ CŨ BẠN ĐÃ VIẾT
    pipeline.push({
      $addFields: {
        computed_status: {
          $cond: {
            if: { $eq: ['$has_variants', true] },
            then: {
              $map: {
                input: '$variants',
                as: 'v',
                in: {
                  sku: '$$v.sku',
                  status: {
                    $switch: {
                      branches: [
                        {
                          case: { $lte: ['$$v.stock', 0] },
                          then: 'OUT_OF_STOCK',
                        },
                        {
                          case: {
                            $lte: [
                              '$$v.stock',
                              { $ifNull: ['$$v.min_stock', '$min_stock', 0] },
                            ],
                          },
                          then: 'LOW_STOCK',
                        },
                      ],
                      default: 'IN_STOCK',
                    },
                  },
                },
              },
            },
            else: [
              {
                sku: '$sku',
                status: {
                  $switch: {
                    branches: [
                      { case: { $lte: ['$stock', 0] }, then: 'OUT_OF_STOCK' },
                      {
                        case: {
                          $lte: ['$stock', { $ifNull: ['$min_stock', 0] }],
                        },
                        then: 'LOW_STOCK',
                      },
                    ],
                    default: 'IN_STOCK',
                  },
                },
              },
            ],
          },
        },
      },
    } as PipelineStage.AddFields);

    // 4. Lọc theo status (nếu FE có truyền lên và khác 'all')
    if (status && status !== 'all') {
      pipeline.push({
        $match: {
          'computed_status.status': status,
        },
      });
    }

    // 5. Sắp xếp
    const sortStage: Record<string, 1 | -1> = {};
    const sortBy = sort_by || 'created_at';
    sortStage[sortBy] = sort_order === 'desc' ? -1 : 1;

    // 6. Phân trang và Facet
    pipeline.push({
      $facet: {
        data: [
          { $sort: sortStage },
          { $skip: (Number(page) - 1) * Number(limit) },
          { $limit: Number(limit) },
        ],
        total: [{ $count: 'count' }],
      },
    } as PipelineStage.Facet);

    // 7. THỰC THI PIPELINE
    const results =
      await this.productModel.aggregate<AggregationResult>(pipeline);

    const result = results[0];
    const products = result?.data || [];
    const total = result?.total[0]?.count || 0;

    // 8. MAP DỮ LIỆU ĐỂ TRẢ VỀ FRONTEND ĐẦY ĐỦ CÁC CỘT
    const formattedData = products.map((product) => {
      // Lấy tên danh mục đầu tiên
      const categoryName = product.category_info?.[0]?.name || 'N/A';

      // Lấy tên kho hàng (Location)
      const locationName =
        product.warehouse_info?.[0]?.name ||
        product.warehouse_info?.[0]?.code ||
        'Kho chính';

      // Tính Total & Available cho Sản phẩm (nếu không có biến thể)
      const total_quantity = product.stock || 0;
      const available_quantity = total_quantity - (product.stock_on_hold || 0);

      const statusColor =
        product.stock <= 0
          ? 'OUT_OF_STOCK'
          : product.stock <= product.min_stock
            ? 'LOW_STOCK'
            : 'IN_STOCK';

      return {
        _id: product._id,
        sku: product.sku,
        name: product.name,
        thumbnail: product.thumbnail,
        category: categoryName, // Mới thêm cho FE
        location: locationName, // Mới thêm cho FE
        total_quantity: total_quantity, // Đổi tên để map chuẩn FE
        available_quantity: available_quantity, // Tính Available = Stock - Hold
        status_color: statusColor,
        has_variants: product.has_variants,
        min_stock: product.min_stock,
        max_stock: product.max_stock,
        variants:
          product.variants?.map((v) => {
            const varTotal = v.stock || 0;
            const varAvailable = varTotal - (v.stock_on_hold || 0);

            return {
              sku: v.sku,
              total_stock: varTotal,
              available_stock: varAvailable,
              min_stock: v.min_stock,
              max_stock: v.max_stock,
              statusColor:
                v.stock <= 0
                  ? 'OUT_OF_STOCK'
                  : v.stock <= (v.min_stock ?? product.min_stock ?? 0)
                    ? 'LOW_STOCK'
                    : 'IN_STOCK',
            };
          }) || [],
      };
    });

    return {
      data: formattedData,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  // [US2] ĐIỀU CHỈNH TỒN KHO THỦ CÔNG
  async manualAdjust(
    dto: ManualAdjustDto,
    actorId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const { product_id, sku, adjustment_value, reason } = dto;

    // TẠO ID HỢP LỆ CHO HỆ THỐNG ĐỂ VƯỢ QUA MONGOOSE CAST ERROR
    const validActorIdStr = isValidObjectId(actorId)
      ? actorId
      : SYSTEM_CONSTANTS.SYSTEM_ACTOR_ID;
    const validActorObjectId = new Types.ObjectId(validActorIdStr);

    if (!product_id || !isValidObjectId(product_id)) {
      throw new BadRequestException('ID sản phẩm không hợp lệ.');
    }

    const product = await this.productModel.findById(product_id);
    if (!product) throw new BadRequestException('Sản phẩm không tồn tại');

    let oldStock = 0;
    if (product.has_variants) {
      const variant = product.variants.find((v) => v.sku === sku);
      if (!variant)
        throw new BadRequestException(`Không tìm thấy biến thể ${sku}`);
      oldStock = variant.stock;
    } else {
      oldStock = product.stock;
    }

    const newStock = oldStock + adjustment_value;
    if (newStock < 0)
      throw new BadRequestException(
        'Tồn kho cuối cùng không được phép nhỏ hơn 0 (AC7).',
      );

    const filter: FilterQuery<ProductDocument> = {
      _id: new Types.ObjectId(product_id),
    };

    const updateQuery: UpdateQuery<ProductDocument> = {};
    if (product.has_variants) {
      filter['variants.sku'] = sku;
      updateQuery.$inc = {
        'variants.$.stock': adjustment_value,
        stock: adjustment_value,
      };
    } else {
      updateQuery.$inc = { stock: adjustment_value };
    }

    const updatedProduct = await this.productModel.findOneAndUpdate(
      filter,
      updateQuery,
      { new: true },
    );
    if (!updatedProduct)
      throw new BadRequestException('Không thể cập nhật tồn kho.');

    // LOG AUDIT VỚI ID HỢP LỆ
    await this.auditLogsService.log({
      action: 'MANUAL_ADJUST_STOCK',
      collection_name: Resource.INVENTORY,
      actor_id: validActorIdStr,
      target_id: product._id.toString(),
      department: Department.WAREHOUSE,
      detail: {
        sku: sku || product.sku,
        old_value: oldStock,
        new_value: newStock,
        adjustment: adjustment_value,
        reason: reason,
      },
      ip,
      user_agent: userAgent,
    });

    this.stockGateway.emitStockUpdate(product_id, sku, newStock);

    // MAPPING CHUẨN CẤU TRÚC THEO STOCK-TRANSACTION.SCHEMA.TS
    await this.transactionModel.create({
      transaction_code: `ADJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action_type: 'MANUAL_ADJUST',
      status: 'COMPLETED',
      items: [
        {
          product_id: product._id,
          sku: sku || product.sku,
          quantity: Math.abs(adjustment_value) || 1, // Đảm bảo số dương (min 1)
          note: `Thay đổi: ${adjustment_value > 0 ? '+' : ''}${adjustment_value}`,
        },
      ],
      total_quantity: Math.abs(adjustment_value) || 1,
      note: `Điều chỉnh thủ công (Cũ: ${oldStock}, Mới: ${newStock})`,
      reason: reason || 'Không có lý do',
      actor_id: validActorObjectId,
    });

    await this.triggerStockAlert(updatedProduct, sku);

    return {
      success: true,
      message: 'Điều chỉnh tồn kho thành công',
      new_stock: newStock,
    };
  }

  // [US4] TIẾP NHẬN ĐƠN HÀNG (Hỗ trợ cả Xuất kho và Nhập kho hoàn trả/thu cũ)
  async acceptOrders(
    dto: AcceptOrderDto,
    actorId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const { order_ids } = dto;
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ order_id: string; reason: string }>,
    };

    const validActorIdStr = isValidObjectId(actorId)
      ? actorId
      : SYSTEM_CONSTANTS.SYSTEM_ACTOR_ID;
    const validActorObjectId = new Types.ObjectId(validActorIdStr);

    for (const orderId of order_ids) {
      try {
        const order = await this.orderModel.findById(orderId);

        if (!order) throw new Error('Đơn hàng không tồn tại');
        if (order.status === 'CANCELLED')
          throw new Error('Đơn hàng đã bị hủy (AC4)');

        // Phân loại luồng xử lý dựa trên trạng thái đơn hàng
        const isExport = ['PENDING', 'CONFIRMED'].includes(order.status);
        const isImport = ['RETURNED', 'TRADE_IN_REVIEW'].includes(order.status);

        if (!isExport && !isImport) {
          throw new Error(`Trạng thái không hợp lệ để duyệt: ${order.status}`);
        }

        // Lặp qua từng sản phẩm trong đơn hàng
        for (const item of order.items) {
          const product = await this.productModel
            .findById(item.product_id)
            .select('has_variants stock stock_on_hold variants name');

          if (!product) throw new Error(`Sản phẩm ${item.sku} không tồn tại`);

          const filter: FilterQuery<ProductDocument> = { _id: item.product_id };
          const update: UpdateQuery<ProductDocument> = {
            $inc: {} as Record<string, number>,
          };

          if (isExport) {
            // ==========================================
            // LUỒNG XUẤT KHO (Đơn hàng bán ra)
            // ==========================================
            let currentHold = 0;

            if (product.has_variants) {
              const v = product.variants.find((x) => x.sku === item.sku);
              if (!v) throw new Error(`Không tìm thấy biến thể ${item.sku}`);
              currentHold = v.stock_on_hold ?? 0;
            } else {
              currentHold = product.stock_on_hold ?? 0;
            }

            // Giải phóng lượng Hold (nếu có hold, không thì trừ 0)
            const holdToDeduct = Math.min(currentHold, item.quantity);

            if (product.has_variants) {
              filter['variants.sku'] = item.sku;
              update.$inc = {
                'variants.$.stock_on_hold': -holdToDeduct, // Giải phóng hold
                'variants.$.stock': -item.quantity, // Trừ đứt số lượng khỏi kho vật lý
                stock: -item.quantity, // Trừ số tổng
              };
            } else {
              update.$inc = {
                stock_on_hold: -holdToDeduct, // Giải phóng hold
                stock: -item.quantity, // Trừ đứt số lượng khỏi kho vật lý
              };
            }
          } else {
            // ==========================================
            // LUỒNG NHẬP KHO (Hàng Hoàn trả / Thu cũ)
            // ==========================================
            if (product.has_variants) {
              filter['variants.sku'] = item.sku;
              update.$inc = {
                'variants.$.stock': item.quantity,
                stock: item.quantity,
              };
            } else {
              update.$inc = {
                stock: item.quantity,
              };
            }
          }

          // Thực hiện cập nhật Database
          const updatedProduct = await this.productModel.findOneAndUpdate(
            filter,
            update,
            { new: true },
          );

          // Phát sự kiện cập nhật Realtime qua Socket
          if (updatedProduct) {
            let currentStock = updatedProduct.stock;
            if (updatedProduct.has_variants) {
              const v = updatedProduct.variants.find((x) => x.sku === item.sku);
              if (v) currentStock = v.stock;
            }
            this.stockGateway.emitStockUpdate(
              updatedProduct._id.toString(),
              item.sku,
              currentStock,
            );
          }

          // GHI NHẬN TRANSACTION LỊCH SỬ NHẬP/XUẤT
          await this.transactionModel.create({
            transaction_code: `ACC-${order.order_code}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            action_type: isExport ? 'ORDER_ACCEPTED' : 'IMPORT',
            status: 'COMPLETED',
            items: [
              {
                product_id: item.product_id,
                sku: item.sku,
                quantity: item.quantity,
                note: isExport
                  ? 'Trừ kho xuất bán'
                  : 'Nhập lại kho (Hoàn trả/Thu cũ)',
              },
            ],
            total_quantity: item.quantity,
            note: isExport
              ? `Tiếp nhận đơn hàng ${order.order_code}`
              : `Thu nhận hàng từ phiếu ${order.order_code}`,
            reason: isExport
              ? `Xuất đơn hàng ${order.order_code}`
              : `Nhập hàng hoàn trả/thu cũ ${order.order_code}`,
            reference_code: String(order.order_code),
            actor_id: validActorObjectId,
          });
        }

        // Cập nhật trạng thái đơn hàng (Order Status)
        // Nếu là hàng trả về thì đổi thành COMPLETED để đánh dấu kho đã hoàn tất khâu nhận
        order.status = isExport ? 'PROCESSING' : 'COMPLETED';
        order.timeline.push({
          status: order.status,
          timestamp: new Date(),
          actor: validActorIdStr,
          note: isExport
            ? 'Đã tiếp nhận đơn hàng xuất'
            : 'Kho đã nhận được hàng và nhập lại thành công',
        });
        await order.save();

        // Ghi Audit Log
        await this.auditLogsService.log({
          action: isExport ? 'ACCEPT_ORDER_EXPORT' : 'ACCEPT_ORDER_IMPORT',
          collection_name: Resource.TRANSFERS,
          actor_id: validActorIdStr,
          target_id: order._id.toString(),
          department: Department.WAREHOUSE,
          detail: {
            order_code: String(order.order_code),
            message: `Tiếp nhận thành công. Trạng thái -> ${order.status}`,
          },
          ip,
          user_agent: userAgent,
        });

        results.success++;
      } catch (error: unknown) {
        const err = error as Error;
        results.failed++;
        results.errors.push({ order_id: orderId, reason: err.message });
      }
    }

    return { message: 'Hoàn tất quy trình xử lý yêu cầu', ...results };
  }

  private async triggerStockAlert(
    productDoc: ProductDocument | null | undefined,
    targetSku: string,
  ) {
    if (!productDoc) return;

    const doc = productDoc as unknown as ProductAlertDoc;

    let currentStock = 0;
    let minStock = 0;
    let maxStock = 999999;

    if (doc.has_variants && Array.isArray(doc.variants)) {
      const v = doc.variants.find((x) => x.sku === targetSku);
      if (v) {
        currentStock = Number(v.stock) || 0;
        minStock = Number(v.min_stock) || 0;
        maxStock = Number(v.max_stock) || 999999;
      }
    } else {
      currentStock = Number(doc.stock) || 0;
      minStock = Number(doc.min_stock) || 0;
      maxStock = Number(doc.max_stock) || 999999;
    }

    await this.checkAndNotifyStock(
      {
        _id: String(doc._id),
        name: String(doc.name || 'Sản phẩm không xác định'),
        warehouse_id: String(doc.warehouse_id || 'DEFAULT'),
      },
      {
        sku: targetSku || 'default',
        stock: currentStock,
        min_stock: minStock,
        max_stock: maxStock,
      },
    );
  }

  // [AC2] BƯỚC 1: TẠM GIỮ HÀNG (HOLD)
  async holdStock(dto: AdjustStockDto, session?: ClientSession) {
    const { product_id, sku, quantity } = dto;

    const product = await this.productModel
      .findById(product_id)
      .select('has_variants')
      .session(session || null);

    if (!product) throw new BadRequestException('Sản phẩm không tồn tại');

    const filter: FilterQuery<ProductDocument> = {
      _id: new Types.ObjectId(product_id),
      status: 'ACTIVE',
    };

    let update: UpdateQuery<ProductDocument> = {};
    const queryFilter: FilterQuery<ProductDocument> = { ...filter };

    if (product.has_variants) {
      queryFilter['variants.sku'] = sku;
      queryFilter['$or'] = [
        // Sửa lại logic: Tổng kho trừ đi số đang hold phải >= quantity mới cho mua
        {
          $expr: {
            $gte: [
              { $subtract: ['$variants.stock', '$variants.stock_on_hold'] },
              quantity,
            ],
          },
        },
        { allow_backorder: true },
      ];
      // [FIX QUAN TRỌNG]: Chỉ giữ hàng, KHÔNG TRỪ STOCK TỔNG
      update = {
        $inc: {
          'variants.$.stock_on_hold': quantity,
        },
      };
    } else {
      queryFilter['$or'] = [
        {
          $expr: {
            $gte: [{ $subtract: ['$stock', '$stock_on_hold'] }, quantity],
          },
        },
        { allow_backorder: true },
      ];
      // [FIX QUAN TRỌNG]: Chỉ giữ hàng, KHÔNG TRỪ STOCK TỔNG
      update = {
        $inc: {
          stock_on_hold: quantity,
        },
      };
    }

    const result = await this.productModel.findOneAndUpdate(
      queryFilter,
      update,
      { new: true, session },
    );

    if (!result) {
      throw new BadRequestException(
        `Sản phẩm ${sku || product_id} không đủ tồn kho.`,
      );
    }

    await this.triggerStockAlert(result, sku);

    let currentStock = result.stock;
    if (result.has_variants && sku) {
      const v = result.variants.find((x) => x.sku === sku);
      if (v) currentStock = v.stock;
    }
    this.stockGateway.emitStockUpdate(
      result._id.toString(),
      sku || result.sku,
      currentStock,
    );

    return { success: true, sku, held_quantity: quantity };
  }

  // [AC2] BƯỚC 2: TRỪ KHO CHÍNH THỨC (DEDUCT)
  async finalizeDeduction(dto: AdjustStockDto, session?: ClientSession) {
    const { product_id, sku, quantity } = dto;

    const filter: FilterQuery<ProductDocument> = {
      _id: new Types.ObjectId(product_id),
    };

    let update: UpdateQuery<ProductDocument> = {};

    const product = await this.productModel
      .findById(product_id)
      .select('has_variants')
      .session(session || null);

    if (product?.has_variants) {
      filter['variants.sku'] = sku;
      update = { $inc: { 'variants.$.stock_on_hold': -quantity } };
    } else {
      update = { $inc: { stock_on_hold: -quantity } };
    }

    const result = await this.productModel.findOneAndUpdate(filter, update, {
      new: true,
      session,
    });

    if (result) {
      await this.triggerStockAlert(result, sku);
    }

    return { success: true, message: 'Đã trừ kho chính thức' };
  }

  // [AC2] BƯỚC 3: HOÀN KHO (RESTOCK)
  async restock(dto: AdjustStockDto, session?: ClientSession) {
    const { product_id, sku, quantity } = dto;

    const product = await this.productModel
      .findById(product_id)
      .select('has_variants')
      .session(session || null);

    if (!product) return;

    const filter: FilterQuery<ProductDocument> = {
      _id: new Types.ObjectId(product_id),
    };

    let update: UpdateQuery<ProductDocument> = {};

    if (product.has_variants) {
      filter['variants.sku'] = sku;
      update = {
        $inc: {
          'variants.$.stock': quantity,
          'variants.$.stock_on_hold': -quantity,
          stock: quantity,
        },
      };
    } else {
      update = {
        $inc: {
          stock: quantity,
          stock_on_hold: -quantity,
        },
      };
    }

    const result = await this.productModel.findOneAndUpdate(filter, update, {
      new: true,
      session,
    });

    if (result) {
      await this.triggerStockAlert(result, sku);

      let currentStock = result.stock;
      if (result.has_variants && sku) {
        const v = result.variants.find((x) => x.sku === sku);
        if (v) currentStock = v.stock;
      }
      this.stockGateway.emitStockUpdate(
        result._id.toString(),
        sku || result.sku,
        currentStock,
      );
    }

    return { success: true, message: 'Đã hoàn kho' };
  }

  // [AC4] KIỂM TRA TRẠNG THÁI
  checkStockStatus(currentStock: number, min: number, max: number) {
    if (currentStock <= min) return 'LOW_STOCK_ALERT';
    if (currentStock > max) return 'OVER_STOCK_ALERT';
    return 'AVAILABLE';
  }

  async checkAndNotifyStock(
    product: { _id: string; name: string; warehouse_id: string },
    variant: VariantStockInfo,
  ) {
    const status = this.checkStockStatus(
      variant.stock,
      variant.min_stock,
      variant.max_stock,
    );

    if (status === 'LOW_STOCK_ALERT') {
      this.eventEmitter.emit(NOTIFY_EVENTS.STOCK_ALERT, {
        product: {
          _id: product._id.toString(),
          name: product.name,
          warehouse_id: product.warehouse_id,
        },
        variant: {
          sku: variant.sku,
        },
        type: 'MIN',
        currentStock: variant.stock,
      });
    }

    if (status === 'OVER_STOCK_ALERT') {
      this.eventEmitter.emit(NOTIFY_EVENTS.STOCK_ALERT, {
        product: {
          _id: product._id.toString(),
          name: product.name,
          warehouse_id: product.warehouse_id,
        },
        variant: {
          sku: variant.sku,
        },
        type: 'MAX',
        currentStock: variant.stock,
      });
    } else if (status === 'AVAILABLE') {
      this.eventEmitter.emit('notification.stock.resolve', {
        sku: variant.sku,
      });
    }
  }

  // [US3 - AC4] THIẾT LẬP NGƯỠNG TỒN KHO
  async updateThresholds(dto: UpdateThresholdsDto, actorId: string) {
    const { product_id, sku, min_stock, max_stock } = dto;
    const validActorIdStr = isValidObjectId(actorId)
      ? actorId
      : SYSTEM_CONSTANTS.SYSTEM_ACTOR_ID;

    const product = await this.productModel.findById(product_id);
    if (!product) throw new BadRequestException('Sản phẩm không tồn tại');

    const filter: FilterQuery<ProductDocument> = {
      _id: new Types.ObjectId(product_id),
    };
    let update: UpdateQuery<ProductDocument> = {};

    if (product.has_variants && sku) {
      filter['variants.sku'] = sku;
      update = {
        $set: {
          'variants.$.min_stock': min_stock,
          'variants.$.max_stock': max_stock,
        },
      };
    } else {
      update = {
        $set: { min_stock, max_stock },
      };
    }

    const updatedProduct = await this.productModel.findOneAndUpdate(
      filter,
      update,
      { new: true },
    );

    if (!updatedProduct)
      throw new BadRequestException('Không thể cập nhật ngưỡng tồn kho.');

    await this.auditLogsService.log({
      action: 'UPDATE_STOCK_THRESHOLDS',
      collection_name: Resource.INVENTORY,
      actor_id: validActorIdStr, // Dùng biến ID chuẩn
      target_id: product._id,
      department: Department.WAREHOUSE,
      detail: {
        sku: sku || product.sku,
        new_min: min_stock,
        new_max: max_stock,
        message: `Thay đổi ngưỡng cảnh báo tồn kho cho ${sku || product.name}`,
      },
      is_success: true,
    });

    await this.triggerStockAlert(updatedProduct, sku || product.sku);

    return { success: true, message: 'Đã cập nhật ngưỡng cảnh báo tồn kho' };
  }

  // [US4 - AC2] BÁO CÁO VẤN ĐỀ (TẠM GIỮ ĐƠN HÀNG)
  async reportOrderIssue(dto: ReportIssueDto, actorId: string) {
    const { order_id, reason } = dto;
    const order = await this.orderModel.findById(order_id);

    const validActorIdStr = isValidObjectId(actorId)
      ? actorId
      : SYSTEM_CONSTANTS.SYSTEM_ACTOR_ID;

    if (!order) throw new BadRequestException('Đơn hàng không tồn tại');

    order.status = 'ON_HOLD';
    order.timeline.push({
      status: 'ON_HOLD',
      timestamp: new Date(),
      actor: validActorIdStr,
      note: `Gửi phản hồi / Tạm giữ: ${reason}`,
    });

    await order.save();

    await this.auditLogsService.log({
      action: 'REPORT_ORDER_ISSUE',
      collection_name: Resource.TRANSFERS,
      actor_id: validActorIdStr, // Dùng biến ID chuẩn
      target_id: order._id,
      department: Department.WAREHOUSE,
      detail: {
        order_code: String(order.order_code),
        reason: reason,
        message: `Đơn hàng bị tạm giữ để xử lý vấn đề.`,
      },
      is_success: true,
    });

    this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
      error_code: `ORDER_HOLD_${String(order.order_code)}`,
      message: `Đơn hàng #${String(order.order_code)} bị tạm giữ bởi kho. Lý do: ${reason}`,
      severity: 'HIGH',
    });

    return { success: true, message: 'Đã ghi nhận vấn đề và tạm giữ đơn hàng' };
  }

  // LẤY DANH SÁCH YÊU CẦU XUẤT/NHẬP KHO CHỜ DUYỆT (Đồng bộ với FE RequestTab)
  async getPendingRequests(queryDto: GetPendingRequestsDto) {
    const { search, type, status, page = 1, limit = 10 } = queryDto;

    const filter: FilterQuery<OrderDocument> = {};

    // 1. TẠO TẬP HỢP CÁC TRẠNG THÁI (STATUS) ĐƯỢC PHÉP DỰA TRÊN FILTER CỦA FE
    let allowedStatuses: string[] = [];

    if (status === RequestFilterStatus.PENDING) {
      // Pending của Kho bao gồm Đơn chờ xuất đi VÀ Đơn chờ nhập về
      allowedStatuses = ['PENDING', 'CONFIRMED', 'TRADE_IN_REVIEW', 'RETURNED'];
    } else if (status === RequestFilterStatus.ACCEPTED) {
      // Đã duyệt (Thành công)
      allowedStatuses = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'];
    } else if (status === RequestFilterStatus.REJECTED) {
      // Bị từ chối / Tạm giữ
      allowedStatuses = ['ON_HOLD', 'CANCELLED'];
    } else {
      // ALL
      allowedStatuses = [
        'PENDING',
        'CONFIRMED',
        'TRADE_IN_REVIEW',
        'RETURNED',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
        'COMPLETED',
        'ON_HOLD',
        'CANCELLED',
      ];
    }

    // 2. LỌC TIẾP THEO LOẠI (TYPE: IMPORT / EXPORT)
    if (type === RequestFilterType.IMPORT) {
      // Chỉ giữ lại các status thuộc luồng nhập kho
      allowedStatuses = allowedStatuses.filter((s) =>
        ['TRADE_IN_REVIEW', 'RETURNED'].includes(s),
      );
    } else if (type === RequestFilterType.EXPORT) {
      // Loại bỏ các status thuộc luồng nhập kho
      allowedStatuses = allowedStatuses.filter(
        (s) => !['TRADE_IN_REVIEW', 'RETURNED'].includes(s),
      );
    }

    // Áp dụng mảng status cuối cùng vào điều kiện truy vấn
    filter.status = { $in: allowedStatuses };

    // 3. TÌM KIẾM THEO MÃ ĐƠN
    if (search) {
      filter.order_code = { $regex: search, $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);

    // 4. TRUY VẤN DATABASE
    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .populate('items.product_id', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean<PopulatedOrder[]>(),
      this.orderModel.countDocuments(filter),
    ]);

    // 5. MAP DỮ LIỆU ĐỂ TRẢ VỀ FRONTEND CHUẨN XÁC
    const formattedData: RequestDataOutput[] = orders.map((order) => {
      let mappedStatus: 'pending' | 'accepted' | 'rejected' = 'pending';
      let mappedType: 'import' | 'export' = 'export';
      let mappedSource: 'Sales' | 'Purchasing' = 'Sales'; // Mặc định là Bán hàng

      // Phân loại Import / Export và Nguồn (Source)
      if (['RETURNED', 'TRADE_IN_REVIEW'].includes(order.status)) {
        mappedType = 'import';
        mappedSource = 'Purchasing'; // <-- ĐÃ SỬA: Đơn hoàn/thu cũ sẽ tính là Thu mua (Purchasing)
      }

      // Phân loại Status cho giao diện
      if (
        ['PENDING', 'CONFIRMED', 'TRADE_IN_REVIEW', 'RETURNED'].includes(
          order.status,
        )
      ) {
        mappedStatus = 'pending';
      } else if (['ON_HOLD', 'CANCELLED'].includes(order.status)) {
        mappedStatus = 'rejected';
      } else {
        mappedStatus = 'accepted';
      }

      // Lấy ghi chú mới nhất từ timeline
      let latestNote = '';
      if (order.timeline && order.timeline.length > 0) {
        latestNote = order.timeline[order.timeline.length - 1].note || '';
      }

      return {
        id: order._id.toString(),
        requestCode: String(order.order_code || order._id),
        type: mappedType,
        source: mappedSource, // <-- TRUYỀN BIẾN ĐỘNG VÀO ĐÂY ĐỂ FE NHẬN
        status: mappedStatus,
        createdAt: order.createdAt || order.created_at || new Date(),
        note: latestNote,
        items: order.items.map((item) => {
          return {
            sku: item.sku,
            productName: item.product_name || 'Sản phẩm không xác định',
            quantity: item.quantity,
          };
        }),
      };
    });

    return {
      data: formattedData,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }
}
