import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Model,
  Types,
  ClientSession,
  FilterQuery,
  UpdateQuery,
  isValidObjectId,
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
      out_of_stock,
      sort_by,
      sort_order,
      page = 1,
      limit = 10,
    } = queryDto as GetStockDto & { page?: number; limit?: number };

    const filter: FilterQuery<ProductDocument> = { is_deleted: false };

    if (search) {
      filter.$or = [
        { sku: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { 'variants.sku': { $regex: search, $options: 'i' } },
      ];
    }

    if (out_of_stock) {
      filter.$or = [
        { stock: { $lte: 0 }, has_variants: false },
        { 'variants.stock': { $lte: 0 }, has_variants: true },
      ];
    }

    const sort: Record<string, 1 | -1> = {};
    if (sort_by) {
      sort[sort_by] = sort_order === 'desc' ? -1 : 1;
    } else {
      sort['created_at'] = -1;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const products = await this.productModel
      .find(filter)
      .select(
        'sku name thumbnail stock min_stock max_stock has_variants variants status',
      )
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await this.productModel.countDocuments(filter);

    const formattedData = products.map((product) => {
      let statusColor = 'IN_STOCK';
      if (product.stock <= 0) statusColor = 'OUT_OF_STOCK';
      else if (product.stock <= product.min_stock) statusColor = 'LOW_STOCK';
      const variants =
        product.has_variants && Array.isArray(product.variants)
          ? product.variants.map((item) => {
              // Mở rộng type của item hiện tại kèm theo min_stock (optional)
              const v = item as typeof item & { min_stock?: number };

              // Lấy min_stock của biến thể, nếu không có thì lấy của sản phẩm mẹ
              const variantMinStock = v.min_stock ?? product.min_stock ?? 0;

              return {
                sku: v.sku,
                stock: v.stock,
                statusColor:
                  v.stock <= 0
                    ? 'OUT_OF_STOCK'
                    : v.stock <= variantMinStock
                      ? 'LOW_STOCK'
                      : 'IN_STOCK',
              };
            })
          : [];

      return {
        _id: product._id,
        sku: product.sku,
        name: product.name,
        thumbnail: product.thumbnail,
        total_stock: product.stock,
        status_color: statusColor,
        has_variants: product.has_variants,
        variants,
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
    // AC7: Ngăn chặn lưu tồn kho về số âm
    if (newStock < 0)
      throw new BadRequestException(
        'Tồn kho cuối cùng không được phép nhỏ hơn 0 (AC7).',
      );

    // Thực hiện update
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

    // AC5: Ghi Audit Log chi tiết (Audit Trail)
    await this.auditLogsService.log({
      action: 'MANUAL_ADJUST_STOCK',
      collection_name: Resource.INVENTORY,
      actor_id: actorId,
      target_id: product._id.toString(),
      department: Department.WAREHOUSE,
      detail: {
        sku: sku || product.sku,
        old_value: oldStock,
        new_value: newStock,
        adjustment: adjustment_value,
        reason: reason, // AC3: Lý do bắt buộc
      },
      ip,
      user_agent: userAgent,
    });

    // Real-time update (AC2)
    this.stockGateway.emitStockUpdate(product_id, sku, newStock);

    // Ghi StockTransaction để tra cứu nội bộ module
    await this.transactionModel.create({
      product_id: product._id,
      sku: sku || product.sku,
      action_type: 'MANUAL_ADJUST',
      old_value: oldStock,
      new_value: newStock,
      changed_value: adjustment_value,
      reason,
      actor_id: new Types.ObjectId(actorId),
    });

    // AC4: Kiểm tra ngưỡng cảnh báo
    await this.triggerStockAlert(updatedProduct, sku);

    return {
      success: true,
      message: 'Điều chỉnh tồn kho thành công',
      new_stock: newStock,
    };
  }

  // [US4] TIẾP NHẬN ĐƠN HÀNG
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

    for (const orderId of order_ids) {
      try {
        const order = await this.orderModel.findById(orderId);

        if (!order) throw new Error('Đơn hàng không tồn tại');
        if (order.status === 'CANCELLED')
          throw new Error('Đơn hàng đã bị hủy (AC4)');
        if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
          throw new Error(`Trạng thái không hợp lệ: ${order.status}`);
        }

        for (const item of order.items) {
          const product = await this.productModel
            .findById(item.product_id)
            .select('has_variants stock stock_on_hold variants');

          if (!product) throw new Error(`Sản phẩm ${item.sku} không tồn tại`);

          // [FIX US4-AC7] Kiểm tra lại tồn kho lần cuối trước khi trừ
          let currentHold = 0;
          if (product.has_variants) {
            const v = product.variants.find((x) => x.sku === item.sku);
            if (!v) throw new Error(`Không tìm thấy biến thể ${item.sku}`);

            // FIX: Bổ sung type an toàn cho stock_on_hold
            const variantData = v as typeof v & { stock_on_hold?: number };
            currentHold = variantData.stock_on_hold ?? 0;
          } else {
            currentHold = product.stock_on_hold;
          }

          if (currentHold < item.quantity) {
            // Chặn quy trình tiếp nhận và báo lỗi AC7
            throw new Error(
              `Sản phẩm ${item.sku} không đủ tồn kho chờ xử lý (Thực tế: ${currentHold}, Cần: ${item.quantity})`,
            );
          }

          const filter: FilterQuery<ProductDocument> = { _id: item.product_id };
          const update: UpdateQuery<ProductDocument> = {};

          if (product.has_variants) {
            filter['variants.sku'] = item.sku;
            update.$inc = {
              'variants.$.stock_on_hold': -item.quantity,
              // stock_on_hold: -item.quantity,
            };
          } else {
            update.$inc = { stock_on_hold: -item.quantity };
          }

          const updatedProduct = await this.productModel.findOneAndUpdate(
            filter,
            update,
            { new: true },
          );

          if (updatedProduct) {
            // Xác định tồn kho hiện tại để bắn WebSocket
            let currentStock = updatedProduct.stock;
            if (updatedProduct.has_variants) {
              const v = updatedProduct.variants.find((x) => x.sku === item.sku);
              if (v) currentStock = v.stock;
            }

            // Bắn tín hiệu Real-time
            this.stockGateway.emitStockUpdate(
              updatedProduct._id.toString(),
              item.sku,
              currentStock,
            );
          }

          await this.transactionModel.create({
            product_id: item.product_id,
            sku: item.sku,
            action_type: 'ORDER_ACCEPTED',
            old_value: 0,
            new_value: 0,
            changed_value: -item.quantity,
            reason: `Tiếp nhận đơn hàng ${order.order_code}`,
            actor_id: isValidObjectId(actorId)
              ? new Types.ObjectId(actorId)
              : null,
          });
        }

        order.status = 'PROCESSING';
        order.timeline.push({
          status: 'PROCESSING',
          timestamp: new Date(),
          actor: actorId ? actorId.toString() : 'SYSTEM',
          note: 'Đã tiếp nhận đơn hàng',
        });
        await order.save();

        await this.auditLogsService.log({
          action: 'ACCEPT_ORDER',
          collection_name: Resource.TRANSFERS,
          actor_id: actorId,
          target_id: order._id.toString(),
          department: Department.WAREHOUSE,
          detail: {
            order_code: String(order.order_code),
            message: `Tiếp nhận đơn hàng thành công. Trạng thái -> PROCESSING`,
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

    return { message: 'Hoàn tất quy trình tiếp nhận', ...results };
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
        { 'variants.stock': { $gte: quantity } },
        { allow_backorder: true },
      ];
      update = {
        $inc: {
          'variants.$.stock': -quantity,
          'variants.$.stock_on_hold': quantity,
          stock: -quantity,
        },
      };
    } else {
      queryFilter['$or'] = [
        { stock: { $gte: quantity } },
        { allow_backorder: true },
      ];
      update = {
        $inc: {
          stock: -quantity,
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

    // Ghi Audit Log cho hành động thay đổi cấu hình kho (Rất quan trọng để đối soát)
    await this.auditLogsService.log({
      action: 'UPDATE_STOCK_THRESHOLDS',
      collection_name: Resource.INVENTORY,
      actor_id: actorId,
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

    // Áp dụng ngay lập tức để kiểm tra trạng thái và tắt/mở cảnh báo (Real-time AC7, AC8)
    await this.triggerStockAlert(updatedProduct, sku || product.sku);

    return { success: true, message: 'Đã cập nhật ngưỡng cảnh báo tồn kho' };
  }

  // [US4 - AC2] BÁO CÁO VẤN ĐỀ (TẠM GIỮ ĐƠN HÀNG)
  async reportOrderIssue(dto: ReportIssueDto, actorId: string) {
    const { order_id, reason } = dto;
    const order = await this.orderModel.findById(order_id);

    if (!order) throw new BadRequestException('Đơn hàng không tồn tại');

    // Đổi trạng thái sang ON_HOLD (Chờ xác nhận lại)
    order.status = 'ON_HOLD';
    order.timeline.push({
      status: 'ON_HOLD',
      timestamp: new Date(),
      actor: actorId,
      note: `Gửi phản hồi / Tạm giữ: ${reason}`,
    });

    await order.save();

    // BỔ SUNG AUDIT LOG THEO AC6
    await this.auditLogsService.log({
      action: 'REPORT_ORDER_ISSUE',
      collection_name: Resource.TRANSFERS,
      actor_id: actorId,
      target_id: order._id,
      department: Department.WAREHOUSE,
      detail: {
        order_code: String(order.order_code),
        reason: reason,
        message: `Đơn hàng bị tạm giữ để xử lý vấn đề.`,
      },
      is_success: true,
    });

    // Gửi Event cảnh báo cho bộ phận CSKH (Sales/Support)
    this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
      error_code: `ORDER_HOLD_${String(order.order_code)}`,
      message: `Đơn hàng #${String(order.order_code)} bị tạm giữ bởi kho. Lý do: ${reason}`,
      severity: 'HIGH',
    });

    return { success: true, message: 'Đã ghi nhận vấn đề và tạm giữ đơn hàng' };
  }
}
