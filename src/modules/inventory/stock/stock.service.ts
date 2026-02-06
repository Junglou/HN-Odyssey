import {
  BadRequestException,
  Injectable,
  // Đã xóa NotFoundException vì không dùng tới để fix lỗi ESLint
} from '@nestjs/common';
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

@Injectable()
export class StockService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  // [AC2] BƯỚC 1: TẠM GIỮ HÀNG (HOLD)
  async holdStock(dto: AdjustStockDto, session?: ClientSession) {
    const { product_id, sku, quantity } = dto;

    // 1. Lấy thông tin sản phẩm để check has_variants
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
      // LOGIC CŨ (GIỮ NGUYÊN)
      queryFilter['variants.sku'] = sku;
      queryFilter['$or'] = [
        { 'variants.stock': { $gte: quantity } },
        { allow_backorder: true },
      ];
      update = {
        $inc: {
          'variants.$.stock': -quantity,
          'variants.$.stock_on_hold': quantity,
          stock: -quantity, // Đồng bộ kho tổng
        },
      };
    } else {
      // LOGIC MỚI CHO SIMPLE PRODUCT
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

    await this.productModel.updateOne(filter, update).session(session || null);

    return { success: true, message: 'Đã trừ kho chính thức' };
  }

  // [AC2] BƯỚC 3: HOÀN KHO (RESTOCK)
  async restock(dto: AdjustStockDto, session?: ClientSession) {
    const { product_id, sku, quantity } = dto;

    // 1. Check has_variants
    const product = await this.productModel
      .findById(product_id)
      .select('has_variants')
      .session(session || null);
    if (!product) return; // Silent return nếu sp đã bị xóa

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

    await this.productModel.updateOne(filter, update).session(session || null);
    return { success: true, message: 'Đã hoàn kho' };
  }

  // [AC4] KIỂM TRA TRẠNG THÁI
  checkStockStatus(currentStock: number, min: number, max: number) {
    if (currentStock <= 0) return 'OUT_OF_STOCK';
    if (currentStock <= min) return 'LOW_STOCK_ALERT';
    if (currentStock > max) return 'OVER_STOCK_ALERT';
    return 'AVAILABLE';
  }
}
