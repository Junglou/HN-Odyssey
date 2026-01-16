import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { Cart } from './schemas/cart.schema';
import { AddToCartDto } from './dto/add-to-cart.dto';
import {
  UpdateCartItemDto,
  RemoveCartItemDto,
  ChangeVariantDto,
} from './dto/update-cart.dto';
import { Product } from 'src/modules/products/catalog/schemas/product.schema';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';
import { PromotionEngineService } from 'src/modules/marketing/promotions/promotion-engine.service';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    private readonly auditLogsService: AuditLogsService,
    private readonly promotionEngine: PromotionEngineService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  //GET CART & CALCULATE REAL-TIME
  async getCart(userId: string | null, guestSessionId?: string) {
    const filter = userId
      ? { user_id: new Types.ObjectId(userId) }
      : { session_id: guestSessionId };

    const cart = await this.cartModel
      .findOne(filter)
      .populate('items.product_id');

    if (!cart) return { items: [], summary: this.getEmptySummary() };

    const validatedItems: any[] = [];
    const warnings: string[] = [];
    let isCartModified = false;

    // Duyệt qua từng item để validate
    for (const item of cart.items) {
      // Ép kiểu product_id sang Product Document vì đã populate
      const product = item.product_id as unknown as Product;

      // 1. Check Sản phẩm tồn tại & Active
      if (
        !product ||
        product.status !== ProductStatus.ACTIVE ||
        (product as any).isDeleted
      ) {
        warnings.push(
          `Sản phẩm "${product?.name || 'Unknown'}" đã ngừng kinh doanh.`,
        );
        isCartModified = true;
        continue;
      }

      // 2. Check Biến thể
      const variant = product.variants.find((v) => v.sku === item.sku);
      if (!variant) {
        warnings.push(
          `Phân loại hàng của "${product.name}" không còn tồn tại.`,
        );
        isCartModified = true;
        continue;
      }

      // 3. Check Tồn kho & Số lượng
      let finalQty = item.quantity;
      if (variant.stock < finalQty) {
        finalQty = variant.stock;
        warnings.push(
          `Sản phẩm "${product.name} - ${item.sku}" chỉ còn ${variant.stock} món.`,
        );
        isCartModified = true;
      }

      if (variant.stock === 0) {
        warnings.push(`Sản phẩm "${product.name} - ${item.sku}" đã hết hàng.`);
        finalQty = 0; // Đánh dấu 0 để FE disable
      }

      // 4. Lấy giá (Ưu tiên giá Sale)
      const unitPrice =
        variant.sale_price > 0 ? variant.sale_price : variant.price;
      const originalPrice = variant.price;

      // 5. Xử lý hình ảnh
      const variantImage = variant.image || product.thumbnail;

      validatedItems.push({
        productId: (product as any)._id,
        productName: product.name,
        productSlug: product.slug,
        thumbnail: variantImage,
        sku: item.sku,
        attributes: variant.attributes,
        quantity: finalQty,
        stock: variant.stock,
        unitPrice: unitPrice,
        originalPrice: originalPrice,
        subtotal: finalQty * unitPrice,
        maxPurchase: product.max_purchase_qty || 999,
        isError: finalQty === 0 || finalQty > variant.stock,
      });
    }

    // Nếu dữ liệu giỏ hàng bẩn (sp xóa, quá tồn kho), tự động làm sạch DB
    if (isCartModified) {
      cart.items = cart.items.filter((i) => {
        const validItem = validatedItems.find(
          (v) =>
            v.productId.toString() === (i.product_id as any)._id.toString() &&
            v.sku === i.sku,
        );

        if (validItem) {
          i.quantity = validItem.quantity;
          return i.quantity > 0;
        }
        return false;
      });
      await cart.save();
    }

    // Tính toán tổng tiền
    const summary = await this.calculateSummary(
      validatedItems,
      cart.applied_coupon,
    );

    return {
      cartId: cart._id,
      items: validatedItems,
      summary,
      warnings,
    };
  }

  private async calculateSummary(items: any[], couponCode?: string) {
    //TÍNH COMBO (AC10)
    const { items: itemsWithCombo, totalDiscount: comboDiscount } =
      await this.promotionEngine.applyCombos(items);

    // Tính Subtotal dựa trên giá gốc
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

    //TÍNH VOUCHER (AC4)
    let voucherDiscount = 0;
    if (couponCode === 'TEST10') {
      // Trừ đi số tiền đã giảm qua combo trước khi tính voucher (tùy logic business)
      voucherDiscount = (subtotal - comboDiscount) * 0.1;
    }

    const totalDiscount = comboDiscount + voucherDiscount;

    return {
      subtotal,
      discount: totalDiscount, // Tổng giảm (Combo + Voucher)
      shippingFee: 0,
      grandTotal: Math.max(0, subtotal - totalDiscount),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      // Có thể trả thêm itemsWithCombo nếu muốn hiển thị giá từng món đã giảm
    };
  }

  private getEmptySummary() {
    return { subtotal: 0, discount: 0, grandTotal: 0, itemCount: 0 };
  }

  async clearCart(userId: string | null, guestSessionId: string) {
    const filter = userId
      ? { user_id: new Types.ObjectId(userId) }
      : { session_id: guestSessionId };

    const cart = await this.cartModel.findOne(filter);
    if (cart) {
      const itemCountBeforeClear = cart.items.length;
      cart.items = [];
      (cart.applied_coupon as any) = null;

      await cart.save();

      if (itemCountBeforeClear > 0) {
        this.auditLogsService.log({
          action: 'CLEAR_CART',
          collection_name: 'carts',
          actor_id: userId || undefined,
          target_id: cart._id,
          department: Department.SALES,
          detail: {
            session_id: guestSessionId,
            cleared_item_count: itemCountBeforeClear,
          },
        });
      }
    }

    return { items: [], summary: this.getEmptySummary() };
  }

  //CHANGE VARIANT
  async changeVariant(
    userId: string | null,
    dto: ChangeVariantDto,
    ip: string,
    userAgent: string,
  ) {
    const filter = userId
      ? { user_id: new Types.ObjectId(userId) }
      : { session_id: dto.guestSessionId };

    const cart = await this.cartModel.findOne(filter);
    if (!cart) throw new NotFoundException('Giỏ hàng trống');

    const oldItemIndex = cart.items.findIndex(
      (i) =>
        i.product_id.toString() === dto.productId &&
        i.sku === dto.oldVariantSku,
    );
    if (oldItemIndex === -1)
      throw new NotFoundException('Sản phẩm không có trong giỏ');

    const qtyToMove = cart.items[oldItemIndex].quantity;

    const product = await this.productModel.findById(dto.productId);
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    const newVariant = product.variants.find(
      (v) => v.sku === dto.newVariantSku,
    );

    if (!newVariant || !newVariant.active)
      throw new BadRequestException('Biến thể mới không khả dụng');
    if (newVariant.stock < qtyToMove)
      throw new BadRequestException(
        `Biến thể mới chỉ còn ${newVariant.stock} sản phẩm`,
      );

    const existingNewItemIndex = cart.items.findIndex(
      (i) =>
        i.product_id.toString() === dto.productId &&
        i.sku === dto.newVariantSku,
    );

    if (existingNewItemIndex > -1) {
      // CASE A: Đã có -> Cộng dồn
      const newTotalQty = cart.items[existingNewItemIndex].quantity + qtyToMove;

      if (newTotalQty > newVariant.stock) {
        throw new BadRequestException(
          `Không thể gộp. Tổng số lượng (${newTotalQty}) vượt quá tồn kho.`,
        );
      }
      cart.items[existingNewItemIndex].quantity = newTotalQty;
      cart.items.splice(oldItemIndex, 1);
    } else {
      // CASE B: Chưa có -> Đổi SKU
      cart.items[oldItemIndex].sku = dto.newVariantSku;
    }

    await cart.save();

    this.auditLogsService.log({
      action: 'CHANGE_CART_VARIANT',
      collection_name: 'carts',
      actor_id: userId || undefined,
      target_id: cart._id,
      department: Department.SALES,
      detail: {
        product_id: dto.productId,
        old_sku: dto.oldVariantSku,
        new_sku: dto.newVariantSku,
        session_id: dto.guestSessionId,
      },
      ip: ip,
      user_agent: userAgent,
    });

    //Truyền undefined thay vì null
    return this.getCart(userId, dto.guestSessionId);
  }

  //ADD TO CART
  async addToCart(
    userId: string | null,
    dto: AddToCartDto,
    ip: string,
    userAgent: string,
  ) {
    const session: ClientSession = await this.connection.startSession();
    session.startTransaction();

    try {
      // 1. Lấy thông tin Sản phẩm (Có Session để đảm bảo tính nhất quán)
      const product = await this.productModel
        .findById(dto.productId)
        .session(session);

      //VALIDATION SẢN PHẨM
      if (!product || product.status !== ProductStatus.ACTIVE) {
        throw new NotFoundException(
          'Sản phẩm không tồn tại hoặc ngừng kinh doanh',
        );
      }

      if (product.is_member_only && !userId) {
        throw new BadRequestException(
          'Vui lòng đăng nhập để mua sản phẩm này.',
        );
      }

      const variant = product.variants.find((v) => v.sku === dto.variantSku);
      if (!variant)
        throw new BadRequestException('Phân loại hàng không hợp lệ');

      if (!variant.active || variant.stock === 0)
        throw new BadRequestException('Sản phẩm này tạm thời hết hàng');

      // Check sơ bộ số lượng request vs tồn kho
      if (dto.quantity > variant.stock)
        throw new BadRequestException(`Kho chỉ còn ${variant.stock} sản phẩm`);

      //XỬ LÝ GIỎ HÀNG
      const filter = userId
        ? { user_id: new Types.ObjectId(userId) }
        : { session_id: dto.guestSessionId };

      // Lấy giỏ hàng hiện tại (hoặc null nếu chưa có)
      let cart = await this.cartModel.findOne(filter).session(session);

      // Nếu chưa có giỏ -> Tạo mới (Trong RAM, chưa save)
      if (!cart) {
        cart = new this.cartModel({
          ...filter,
          items: [],
        });
      }

      // Tìm xem sản phẩm đã có trong giỏ chưa
      const itemIndex = cart.items.findIndex(
        (i) =>
          i.product_id.toString() === dto.productId && i.sku === dto.variantSku,
      );

      let newQuantity = dto.quantity;

      if (itemIndex > -1) {
        // CASE A: Đã có -> Cộng dồn
        newQuantity += cart.items[itemIndex].quantity;
        cart.items[itemIndex].quantity = newQuantity;
        cart.items[itemIndex].selected_at = new Date();
      } else {
        // CASE B: Chưa có -> Push mới
        // Check giới hạn 50 món (AC14)
        if (cart.items.length >= 50) {
          throw new BadRequestException('Giỏ hàng đã đầy (Tối đa 50 sản phẩm)');
        }
        cart.items.push({
          product_id: new Types.ObjectId(dto.productId),
          sku: dto.variantSku,
          quantity: dto.quantity,
          selected_at: new Date(),
        } as any);
      }

      //VALIDATE LOGIC TỔNG HỢP (AC3 & AC5)
      // Kiểm tra tổng số lượng sau khi cộng dồn so với Tồn kho
      if (newQuantity > variant.stock) {
        throw new BadRequestException(
          `Tổng số lượng mua vượt quá tồn kho (Kho: ${variant.stock}, Giỏ: ${newQuantity})`,
        );
      }

      // Validate Max Purchase Qty (AC14 - biến thể Purchase Constraints)
      if (product.max_purchase_qty && product.max_purchase_qty > 0) {
        if (newQuantity > product.max_purchase_qty) {
          throw new BadRequestException(
            `Sản phẩm này giới hạn mua tối đa ${product.max_purchase_qty} cái (Giỏ hàng của bạn đang có: ${newQuantity}).`,
          );
        }

        // Min quantity chỉ check trên lượng mua thêm (dto) hoặc tổng thể
        const minQty = product.min_purchase_qty || 1;
        if (newQuantity < minQty) {
          throw new BadRequestException(
            `Cần mua tối thiểu ${minQty} sản phẩm.`,
          );
        }
      }
      await cart.save({ session });
      await session.commitTransaction();

      this.auditLogsService.log({
        action: 'ADD_TO_CART',
        collection_name: 'carts',
        actor_id: userId || undefined,
        target_id: cart._id,
        department: Department.SALES,
        detail: {
          product_id: dto.productId,
          sku: dto.variantSku,
          quantity: dto.quantity,
          session_id: dto.guestSessionId,
        },
        ip,
        user_agent: userAgent,
      });

      return this.getCart(userId, dto.guestSessionId);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  //UPDATE ITEM QUANTITY
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

    if (product.max_purchase_qty && dto.quantity > product.max_purchase_qty) {
      throw new BadRequestException(
        `Sản phẩm này giới hạn mua tối đa ${product.max_purchase_qty} cái.`,
      );
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
        department: Department.SALES,
        actor_id: userId || undefined,
        target_id: cart._id,
        detail: {
          product_id: dto.productId,
          sku: dto.variantSku,
          new_quantity: dto.quantity,
        },
        ip,
        user_agent: userAgent,
      });
    }
    return this.getCart(userId, dto.guestSessionId);
  }

  // ACTION: REMOVE ITEM
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
      department: Department.SALES,
      actor_id: userId || undefined,
      target_id: null,
      detail: {
        product_id: dto.productId,
        sku: dto.variantSku,
        session_id: dto.guestSessionId,
      },
      ip,
      user_agent: userAgent,
    });

    return this.getCart(userId, dto.guestSessionId);
  }

  //MERGE GUEST CART (Login)
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
    //check giỏ hàng null trước khi truy cập items
    if (!guestCart || guestCart.items.length === 0) {
      return this.getCart(userId, undefined);
    }

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

    const productIds = guestCart.items.map((i) => i.product_id);
    const products = await this.productModel
      .find({ _id: { $in: productIds } })
      .lean();

    for (const guestItem of guestCart.items) {
      const product = products.find(
        (p) => p._id.toString() === guestItem.product_id.toString(),
      );
      if (!product || product.status !== ProductStatus.ACTIVE) continue;

      const variant = product.variants.find((v) => v.sku === guestItem.sku);
      if (!variant || !variant.active || variant.stock <= 0) continue;

      const existingIndex = memberCart.items.findIndex(
        (mItem) =>
          mItem.product_id.toString() === guestItem.product_id.toString() &&
          mItem.sku === guestItem.sku,
      );

      let finalQuantity = guestItem.quantity;

      if (existingIndex > -1) {
        finalQuantity += memberCart.items[existingIndex].quantity;
      }

      if (
        product.max_purchase_qty &&
        finalQuantity > product.max_purchase_qty
      ) {
        finalQuantity = product.max_purchase_qty;
      }

      if (finalQuantity > variant.stock) {
        finalQuantity = variant.stock;
      }

      if (existingIndex > -1) {
        memberCart.items[existingIndex].quantity = finalQuantity;
        memberCart.items[existingIndex].selected_at = new Date();
      } else {
        memberCart.items.push({
          product_id: guestItem.product_id,
          sku: guestItem.sku,
          quantity: finalQuantity,
          selected_at: new Date(),
        });
      }
    }

    await memberCart.save();
    await this.cartModel.deleteOne({ _id: guestCart._id });

    await this.auditLogsService.log({
      action: 'MERGE_GUEST_CART',
      collection_name: 'carts',
      department: Department.SALES,
      actor_id: userId,
      target_id: memberCart._id,
      detail: { merged_items: guestCart.items.length },
      ip,
      user_agent: userAgent,
    });

    return this.getCart(userId, undefined);
  }
}
