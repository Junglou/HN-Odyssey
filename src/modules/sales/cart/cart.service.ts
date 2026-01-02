import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart } from './schemas/cart.schema';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto, RemoveCartItemDto } from './dto/update-cart.dto';
import { Product } from 'src/modules/products/catalog/schemas/product.schema';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // AC16: Hiệu năng & Race Condition Handling
  async addToCart(
    userId: string | null,
    dto: AddToCartDto,
    ip: string,
    userAgent: string,
  ) {
    // 1. Validate Sản phẩm & Tồn kho
    const product = await this.productModel.findById(dto.productId);
    let resultCartId;

    if (!product || product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException(
        'Sản phẩm không tồn tại hoặc ngừng kinh doanh',
      );
    }

    if (product.is_member_only && !userId) {
      throw new BadRequestException(
        'Sản phẩm này dành riêng cho thành viên. Vui lòng đăng nhập để thêm vào giỏ.',
      );
    }

    const variant = product.variants.find((v) => v.sku === dto.variantSku);
    if (!variant) {
      throw new BadRequestException('Phân loại hàng không hợp lệ');
    }

    if (!variant.active || variant.stock === 0) {
      throw new BadRequestException('Sản phẩm này tạm thời hết hàng');
    }

    // Check nhanh tồn kho
    if (dto.quantity > variant.stock) {
      throw new BadRequestException(`Kho chỉ còn ${variant.stock} sản phẩm`);
    }

    const filter = userId
      ? { user_id: new Types.ObjectId(userId) }
      : { session_id: dto.guestSessionId };

    //AC13: Validate Max Purchase Quantity (Giới hạn mua)
    if (product.max_purchase_qty && product.max_purchase_qty > 0) {
      // Nếu số lượng khách muốn thêm đã lớn hơn giới hạn -> Chặn luôn
      if (dto.quantity > product.max_purchase_qty) {
        throw new BadRequestException(
          `Sản phẩm này giới hạn mua tối đa ${product.max_purchase_qty} cái/lần.`,
        );
      }

      //Check Min Purchase Quantity (US.AC13)
      const minQty = product.min_purchase_qty || 1;
      if (dto.quantity < minQty) {
        throw new BadRequestException(
          `Sản phẩm này yêu cầu mua tối thiểu ${minQty} cái.`,
        );
      }

      // Nếu sản phẩm đã có trong giỏ -> Phải cộng cả số lượng cũ để check
      const existingCart = await this.cartModel.findOne(
        userId ? { user_id: userId } : { session_id: dto.guestSessionId },
      );
      if (existingCart) {
        const existingItem = existingCart.items.find(
          (i) =>
            i.product_id.toString() === dto.productId &&
            i.sku === dto.variantSku,
        );
        if (
          existingItem &&
          existingItem.quantity + dto.quantity > product.max_purchase_qty
        ) {
          throw new BadRequestException(
            `Bạn đã có ${existingItem.quantity} sản phẩm trong giỏ. Giới hạn tối đa là ${product.max_purchase_qty}.`,
          );
        }
      }
    }

    // 2.SẢN PHẨM ĐÃ CÓ TRONG GIỎ -> CỘNG DỒN (Atomic Update)
    const updatedCart = await this.cartModel.findOneAndUpdate(
      {
        ...filter,
        'items.product_id': new Types.ObjectId(dto.productId),
        'items.sku': dto.variantSku,
      },
      {
        $inc: { 'items.$.quantity': dto.quantity },
        $set: { 'items.$.selected_at': new Date() },
      },
      { new: true },
    );

    if (updatedCart) {
      // AC3: Validate lại tồn kho sau khi cộng dồn
      // Vì MongoDB $inc không check limit, nên ta phải check thủ công sau khi update
      const item = updatedCart.items.find((i) => i.sku === dto.variantSku);

      if (item && item.quantity > variant.stock) {
        //Nếu vượt quá tồn kho, trừ ngược lại ngay lập tức
        await this.cartModel.updateOne(
          { ...filter, 'items.sku': dto.variantSku },
          { $inc: { 'items.$.quantity': -dto.quantity } },
        );
        throw new BadRequestException(
          `Tổng số lượng mua vượt quá tồn kho (Còn lại: ${variant.stock})`,
        );
      }

      return {
        message: 'Updated existing item',
        totalItems: this.countItems(updatedCart),
        cartId: updatedCart._id,
      };
    }

    // 3.SẢN PHẨM CHƯA CÓ -> THÊM MỚI
    const newCart = await this.cartModel.findOneAndUpdate(
      filter,
      {
        $setOnInsert: userId
          ? { user_id: userId }
          : { session_id: dto.guestSessionId },
        $push: {
          items: {
            product_id: new Types.ObjectId(dto.productId),
            sku: dto.variantSku,
            quantity: dto.quantity,
            selected_at: new Date(),
          },
        },
      },
      { upsert: true, new: true },
    );

    // AC14: Validate giới hạn số lượng item trong giỏ (Max 50)
    if (newCart.items.length > 50) {
      //Xóa item vừa thêm vào
      await this.cartModel.updateOne(filter, { $pop: { items: 1 } });
      throw new BadRequestException('Giỏ hàng đã đầy (Tối đa 50 sản phẩm)');
    }

    await this.auditLogsService.log({
      action: 'ADD_TO_CART',
      collection_name: 'carts',
      actor_id: userId ? userId : undefined,
      target_id: resultCartId,
      department: Department.SALE_MARKETING,
      detail: {
        product_id: dto.productId,
        sku: dto.variantSku,
        quantity: dto.quantity,
        price_snapshot:
          variant.sale_price > 0 ? variant.sale_price : variant.price,
        session_id: dto.guestSessionId,
      },
      ip: ip,
      user_agent: userAgent,
    });

    return {
      message: 'Added new item',
      totalItems: this.countItems(newCart),
      cartId: newCart._id,
    };
  }

  // AC: Helper đếm tổng số lượng
  private countItems(cart: Cart) {
    return cart.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  async updateItem(
    userId: string | null,
    dto: UpdateCartItemDto,
    ip: string,
    userAgent: string,
  ) {
    const filter = userId
      ? { user_id: new Types.ObjectId(userId) }
      : { session_id: dto['guestSessionId'] };

    const cart = await this.cartModel.findOne(filter);
    if (!cart) throw new NotFoundException('Giỏ hàng không tồn tại');

    const product = await this.productModel.findById(dto.productId);
    if (!product) throw new NotFoundException('Sản phẩm không còn tồn tại');

    //BỔ SUNG CHECK MAX PURCHASE QTY
    if (product.max_purchase_qty && product.max_purchase_qty > 0) {
      if (dto.quantity > product.max_purchase_qty) {
        throw new BadRequestException(
          `Sản phẩm này giới hạn mua tối đa ${product.max_purchase_qty} cái.`,
        );
      }
    }

    const variant = product.variants.find((v) => v.sku === dto.variantSku);
    if (!variant) throw new NotFoundException('Biến thể không tồn tại');

    if (variant.stock < dto.quantity) {
      throw new BadRequestException(`Kho chỉ còn ${variant.stock} sản phẩm`);
    }

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.product_id.toString() === dto.productId &&
        item.sku === dto.variantSku,
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = dto.quantity;
      await cart.save();

      await this.auditLogsService.log({
        action: 'UPDATE_CART_ITEM',
        collection_name: 'carts',
        department: Department.SALE_MARKETING,
        actor_id: userId || undefined,
        target_id: cart._id,
        detail: {
          product_id: dto.productId,
          sku: dto.variantSku,
          new_quantity: dto.quantity,
          session_id: !userId ? dto['guestSessionId'] : undefined,
        },
        ip,
        user_agent: userAgent,
      });
    }
    return { message: 'Updated' };
  }

  async removeItem(
    userId: string | null,
    dto: RemoveCartItemDto,
    ip: string,
    userAgent: string,
  ) {
    const filter = userId
      ? { user_id: new Types.ObjectId(userId) }
      : { session_id: dto['guestSessionId'] };

    await this.cartModel.updateOne(filter, {
      $pull: {
        items: {
          product_id: new Types.ObjectId(dto.productId),
          sku: dto.variantSku,
        },
      },
    });

    await this.auditLogsService.log({
      action: 'REMOVE_CART_ITEM',
      collection_name: 'carts',
      department: Department.SALE_MARKETING,
      actor_id: userId || undefined,
      target_id: null, // Không query ID giỏ hàng để tiết kiệm resource
      detail: {
        product_id: dto.productId,
        sku: dto.variantSku,
        session_id: !userId ? dto['guestSessionId'] : undefined,
      },
      ip,
      user_agent: userAgent,
    });
    return { message: 'Removed' };
  }

  async mergeGuestCart(
    userId: string,
    guestSessionId: string,
    ip: string,
    userAgent: string,
  ) {
    if (!guestSessionId) return;

    // 1. Lấy giỏ hàng Guest
    const guestCart = await this.cartModel.findOne({
      session_id: guestSessionId,
    });
    if (!guestCart || guestCart.items.length === 0) return;

    // 2. Lấy (hoặc tạo) giỏ hàng Member
    let memberCart = await this.cartModel.findOne({
      user_id: new Types.ObjectId(userId),
    });
    if (!memberCart) {
      memberCart = new this.cartModel({
        user_id: new Types.ObjectId(userId),
        items: [],
      });
    }

    // 3.Lấy danh sách Product ID để query 1 lần
    const productIds = guestCart.items.map((i) => i.product_id);
    const products = await this.productModel
      .find({ _id: { $in: productIds } })
      .lean();

    // 4. Duyệt qua từng item của Guest để merge
    for (const guestItem of guestCart.items) {
      // Tìm thông tin sản phẩm từ list đã query
      const product = products.find(
        (p) => p._id.toString() === guestItem.product_id.toString(),
      );

      // Nếu sản phẩm đã bị xóa hoặc ngừng kinh doanh -> Bỏ qua
      if (!product || product.status !== ProductStatus.ACTIVE) continue;

      // Tìm biến thể tương ứng
      const variant = product.variants.find((v) => v.sku === guestItem.sku);

      // Nếu biến thể lỗi hoặc hết hàng -> Bỏ qua
      if (!variant || !variant.active || variant.stock <= 0) continue;

      // Tìm xem Member đã có món này trong giỏ chưa
      const existingIndex = memberCart.items.findIndex(
        (mItem) =>
          mItem.product_id.toString() === guestItem.product_id.toString() &&
          mItem.sku === guestItem.sku,
      );

      let finalQuantity = guestItem.quantity;

      //Đã có trong giỏ -> Cộng dồn
      if (existingIndex > -1) {
        finalQuantity += memberCart.items[existingIndex].quantity;
      }

      //Validate Logic giới hạn số lượng
      if (
        product.max_purchase_qty &&
        finalQuantity > product.max_purchase_qty
      ) {
        finalQuantity = product.max_purchase_qty;
      }

      // 2. Cắt theo Tồn kho thực tế
      if (finalQuantity > variant.stock) {
        finalQuantity = variant.stock;
      }

      // 3. Update vào Member Cart
      if (existingIndex > -1) {
        // Cập nhật số lượng mới đã validate
        memberCart.items[existingIndex].quantity = finalQuantity;
        // Cập nhật thời gian chọn mới nhất
        memberCart.items[existingIndex].selected_at = new Date();
      } else {
        // Thêm mới (Cẩn thận clone object để tránh lỗi reference)
        memberCart.items.push({
          product_id: guestItem.product_id,
          sku: guestItem.sku,
          quantity: finalQuantity,
          selected_at: new Date(),
        });
      }
    }

    // 5. Lưu và Dọn dẹp
    await memberCart.save();

    // Xóa giỏ hàng Guest cũ
    await this.cartModel.deleteOne({ _id: guestCart._id });

    await this.auditLogsService.log({
      action: 'MERGE_GUEST_CART',
      collection_name: 'carts',
      department: Department.SALE_MARKETING,
      actor_id: userId,
      target_id: memberCart._id,
      detail: {
        guest_session_id: guestSessionId,
        merged_items_count: guestCart.items.length,
      },
      ip,
      user_agent: userAgent,
    });

    return memberCart;
  }
}
