import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import { Cart } from 'src/modules/sales/cart/schemas/cart.schema';
import { AddBundleToCartDto } from '../dto/bundle-cart.dto';

interface BundleResult {
  message: string;
  total_discount: number;
  items_added: number;
}

interface CartItemPayload {
  product_id: Types.ObjectId;
  sku: string;
  quantity: number;
  selected_at: Date;
}

@Injectable()
export class BundleDiscountService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
  ) {}

  async applyComboDiscountAndAddToCart(
    dto: AddBundleToCartDto,
    userId?: string,
  ): Promise<BundleResult> {
    const skus = dto.items.map((i) => i.sku);
    const products = await this.productModel
      .find({
        $or: [{ sku: { $in: skus } }, { 'variants.sku': { $in: skus } }],
      })
      .lean();

    if (products.length !== dto.items.length) {
      throw new BadRequestException(
        'Một hoặc nhiều sản phẩm trong Combo không tồn tại.',
      );
    }

    let totalDiscount = 0;
    const cartItemsToAdd: CartItemPayload[] = [];

    for (const item of dto.items) {
      // 1. Tìm đúng sản phẩm chứa SKU đó
      const product = products.find(
        (p) =>
          p.sku === item.sku || p.variants?.some((v) => v.sku === item.sku),
      );
      if (!product) continue;

      // 2. Phân loại để lấy đúng Tồn kho và Giá (AC13: Tính giá động ở đây luôn)
      let itemPrice = 0;
      let itemStock = 0;

      if (product.sku === item.sku) {
        // Trường hợp A: Là sản phẩm gốc (Không biến thể)
        itemStock = product.stock;
        itemPrice = product.sale_price > 0 ? product.sale_price : product.price;
      } else {
        // Trường hợp B: Là sản phẩm có biến thể
        const variant = product.variants?.find((v) => v.sku === item.sku);
        if (variant) {
          itemStock = variant.stock;
          itemPrice =
            variant.sale_price > 0 ? variant.sale_price : variant.price;
        }
      }

      // 3. AC6: Lọc tồn kho thời gian thực
      if (itemStock < item.quantity) {
        throw new BadRequestException(
          `Sản phẩm (SKU: ${item.sku}) không đủ số lượng tồn kho.`,
        );
      }

      // AC5: Logic giảm giá Bundle (Giảm 10% cho các sản phẩm mua kèm)
      if (item.product_id !== dto.base_product_id) {
        totalDiscount += itemPrice * 0.1 * item.quantity;
      }

      cartItemsToAdd.push({
        product_id: new Types.ObjectId(item.product_id),
        sku: item.sku,
        quantity: item.quantity,
        selected_at: new Date(),
      });
    }

    // AC3: Thêm tất cả vào giỏ (One-click Add)
    const cartMatch = userId
      ? { user_id: new Types.ObjectId(userId) }
      : { session_id: dto.session_id };

    await this.cartModel.findOneAndUpdate(
      cartMatch,
      {
        $push: { items: { $each: cartItemsToAdd } },
        $setOnInsert: {
          session_id: dto.session_id,
          user_id: userId ? new Types.ObjectId(userId) : undefined,
        },
      },
      { upsert: true, new: true },
    );

    return {
      message: 'Đã thêm Combo vào giỏ hàng thành công',
      total_discount: totalDiscount,
      items_added: cartItemsToAdd.length,
    };
  }
}
