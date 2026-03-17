// src/modules/inventory/stock/stock.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Model,
  Types,
  ClientSession,
  FilterQuery,
  UpdateQuery,
} from 'mongoose';

import { AdjustStockDto } from './dto/adjust-stock.dto';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async triggerStockAlert(
    productDoc: ProductDocument | null | undefined,
    targetSku: string,
  ) {
    if (!productDoc) return;

    // Ép kiểu an toàn 2 lớp qua unknown để vượt qua strict mode của ESLint
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

    // GỌI HELPER CHECK STOCK TẠI ĐÂY
    await this.triggerStockAlert(result, sku);

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

    // FIX: Đổi updateOne thành findOneAndUpdate để lấy Document mới nhất
    const result = await this.productModel.findOneAndUpdate(filter, update, {
      new: true,
      session,
    });

    // GỌI HELPER CHECK STOCK TẠI ĐÂY
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

    // FIX: Đổi updateOne thành findOneAndUpdate để lấy Document mới nhất
    const result = await this.productModel.findOneAndUpdate(filter, update, {
      new: true,
      session,
    });

    // GỌI HELPER CHECK STOCK TẠI ĐÂY
    if (result) {
      await this.triggerStockAlert(result, sku);
    }

    return { success: true, message: 'Đã hoàn kho' };
  }

  // [AC4] KIỂM TRA TRẠNG THÁI
  checkStockStatus(currentStock: number, min: number, max: number) {
    // Nếu dưới mức tối thiểu HOẶC bằng 0, âm đều phải báo Alert
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

    // AC2: Cảnh báo khi dưới mức tối thiểu
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

    // AC3: Cảnh báo khi vượt mức tối đa
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
      // AC8: Nếu kho bình thường trở lại, bắn event để tắt cảnh báo cũ
      this.eventEmitter.emit('notification.stock.resolve', {
        sku: variant.sku,
      });
    }
  }
}
