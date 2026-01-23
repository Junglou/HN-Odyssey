import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

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

  // [AC2] BƯỚC 1: TẠM GIỮ HÀNG (HOLD) - Khi khách đặt đơn/vào giỏ
  // [AC7] Đảm bảo tính nhất quán (Concurrency Safety)
  async holdStock(dto: AdjustStockDto) {
    const { product_id, sku, quantity } = dto;

    // Tìm sản phẩm để check cấu hình [AC6] Backorder
    const product = await this.productModel.findById(product_id);
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    let filter = {};
    let update = {};

    // [AC5] Xử lý theo Biến thể (SKU Level) hoặc Sản phẩm đơn
    if (product.has_variants) {
      // Logic query: Tìm đúng ID + đúng SKU biến thể
      // Điều kiện khóa (Lock condition):
      // 1. Stock >= quantity (Còn đủ hàng)
      // 2. HOẶC allow_backorder = true ([AC6] Cho phép bán âm)
      filter = {
        _id: new Types.ObjectId(product_id),
        'variants.sku': sku,
        $or: [
          { 'variants.stock': { $gte: quantity } }, // [AC3] Logic chặn nếu hết hàng
          { allow_backorder: true }, // [AC6] Ngoại lệ bán vượt mức
        ],
      };

      // Hành động: Trừ kho khả dụng, cộng vào kho tạm giữ
      update = {
        $inc: {
          'variants.$.stock': -quantity,
          'variants.$.stock_on_hold': quantity,
        },
      };
    } else {
      // Logic cho sản phẩm không có biến thể
      filter = {
        _id: new Types.ObjectId(product_id),
        $or: [{ stock: { $gte: quantity } }, { allow_backorder: true }],
      };
      update = {
        $inc: { stock: -quantity, stock_on_hold: quantity },
      };
    }

    // Thực thi Atomic Update (AC7)
    const result = await this.productModel.findOneAndUpdate(filter, update, {
      new: true,
    });

    if (!result) {
      // [AC3] Nếu update thất bại -> Tức là hết hàng và không cho backorder
      // Disable nút mua/báo lỗi cho Frontend
      throw new BadRequestException(
        `Sản phẩm ${sku} đã hết hàng (Out of Stock).`,
      );
    }

    return {
      success: true,
      message: 'Đã tạm giữ hàng thành công',
      sku,
      held_quantity: quantity,
    };
  }

  // [AC2] BƯỚC 2: TRỪ KHO CHÍNH THỨC (DEDUCT) - Khi thanh toán xong
  async finalizeDeduction(dto: AdjustStockDto) {
    const { product_id, sku, quantity } = dto;

    // Lúc này hàng đã nằm trong stock_on_hold, ta chỉ cần xóa nó đi
    const filter = { _id: new Types.ObjectId(product_id) };
    let update = {};

    // Check xem là biến thể hay sản phẩm thường để build query
    const product = await this.productModel
      .findById(product_id)
      .select('has_variants');

    if (product?.has_variants) {
      filter['variants.sku'] = sku;
      update = { $inc: { 'variants.$.stock_on_hold': -quantity } };
    } else {
      update = { $inc: { stock_on_hold: -quantity } };
    }

    await this.productModel.updateOne(filter, update);
    return { success: true, message: 'Đã trừ kho chính thức' };
  }

  // [AC2] BƯỚC 3: HOÀN KHO (RESTOCK) - Khi hủy đơn/quá hạn thanh toán
  async restock(dto: AdjustStockDto) {
    const { product_id, sku, quantity } = dto;

    // Trả lại hàng từ on_hold về stock khả dụng
    const filter = { _id: new Types.ObjectId(product_id) };
    let update = {};

    const product = await this.productModel
      .findById(product_id)
      .select('has_variants');

    if (product?.has_variants) {
      filter['variants.sku'] = sku;
      update = {
        $inc: {
          'variants.$.stock': quantity, // Cộng lại kho bán
          'variants.$.stock_on_hold': -quantity, // Trừ kho tạm giữ
        },
      };
    } else {
      update = {
        $inc: { stock: quantity, stock_on_hold: -quantity },
      };
    }

    await this.productModel.updateOne(filter, update);
    return { success: true, message: 'Đã hoàn kho (Restock)' };
  }

  // [AC4] KIỂM TRA TRẠNG THÁI CẢNH BÁO (Helper cho Frontend)
  checkStockStatus(currentStock: number, min: number, max: number) {
    if (currentStock <= 0) return 'OUT_OF_STOCK';
    if (currentStock <= min) return 'LOW_STOCK_ALERT';
    if (currentStock > max) return 'OVER_STOCK_ALERT';
    return 'AVAILABLE';
  }
}
