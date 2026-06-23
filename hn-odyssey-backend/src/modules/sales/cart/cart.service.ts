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
import {
  CartResponse,
  CartSummary,
  ValidatedCartItem,
  PopulatedCartProduct,
} from 'src/common/interfaces/cart-response.interface';
import { User } from 'src/modules/users/schemas/user.schema';
import { ShippingService } from 'src/modules/shipping/shipping.service';
import { CartItem as ICartItem } from 'src/common/interfaces/order.interface';

// --- ĐỊNH NGHĨA INTERFACE LOCAL ĐỂ FIX LỖI TYPE & ESLINT STRICT MODE ---
interface IAddressItem {
  city_code: string;
  district_code: string;
  is_default: boolean;
}

interface IUserWithAddresses {
  addresses?: IAddressItem[];
}

interface IShippingConfigWithFees {
  fees?: {
    other_province: number;
    [key: string]: number;
  };
}
// ------------------------------------------------------------------------

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel('User') private userModel: Model<User>,
    private readonly auditLogsService: AuditLogsService,
    private readonly promotionEngine: PromotionEngineService,
    private readonly shippingService: ShippingService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private getEmptySummary(): CartSummary {
    return {
      subtotal: 0,
      discount: 0,
      shippingFee: 0,
      grandTotal: 0,
      itemCount: 0,
    };
  }

  private async calculateSummary(
    items: ValidatedCartItem[],
    userId: string | null,
    couponCode?: string,
  ): Promise<CartSummary> {
    const cartItems = items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

    const { totalDiscount: comboDiscount } =
      await this.promotionEngine.applyCombos(cartItems);

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    let voucherDiscount = 0;
    if (couponCode === 'TEST10') {
      voucherDiscount = (subtotal - comboDiscount) * 0.1;
    }

    const totalDiscount = comboDiscount + voucherDiscount;

    // --- LOGIC TÍNH PHÍ VẬN CHUYỂN ĐỘNG ---
    let shippingFeeVND = 0;
    const EXCHANGE_RATE = 25400; // Tỷ giá cố định 1 USD = 25,400 VNĐ

    // Đặt trực tiếp ngưỡng Freeship bằng USD (Ví dụ: 150$, bạn thích đổi thành 100$ hay 200$ thì chỉ cần sửa số này)
    const FREESHIP_THRESHOLD_USD = 200;

    if (subtotal >= FREESHIP_THRESHOLD_USD || items.length === 0) {
      shippingFeeVND = 0; // Đơn trên ngưỡng quy định hoặc giỏ hàng trống thì phí ship = 0
    } else {
      let cityCode: string | null = null;
      let districtCode: string | null = null;

      if (userId) {
        const user = (await this.userModel
          .findById(userId)
          .select('addresses')
          .lean()
          .exec()) as unknown as IUserWithAddresses;

        if (user && user.addresses && user.addresses.length > 0) {
          const defaultAddress =
            user.addresses.find((a) => a.is_default) || user.addresses[0];
          cityCode = defaultAddress.city_code;
          districtCode = defaultAddress.district_code;
        }
      }

      const shippingItemsForFee = items.map((i) => ({
        name: i.productName,
        product_name: i.productName,
        code: i.sku,
        quantity: i.quantity,
        price: i.unitPrice,
        weight: i.weight || 500,
      }));

      if (cityCode && districtCode) {
        shippingFeeVND = await this.shippingService.calculateShippingFee(
          cityCode,
          districtCode,
          shippingItemsForFee as unknown as ICartItem[],
          false,
        );
      } else {
        const config =
          (await this.shippingService.getDefaultConfig()) as unknown as IShippingConfigWithFees;
        shippingFeeVND = config?.fees?.other_province || 35000;
      }
    }

    // Quy đổi ngược phí ship nội địa (VNĐ) từ các bên vận chuyển về lại USD để tính tổng tiền đơn hàng
    const shippingFeeUSD =
      shippingFeeVND > 0 ? shippingFeeVND / EXCHANGE_RATE : 0;

    return {
      subtotal,
      discount: totalDiscount,
      shippingFee: shippingFeeUSD,
      grandTotal: Math.max(0, subtotal - totalDiscount + shippingFeeUSD),
      itemCount,
    };
  }

  async getCart(
    userId: string | null,
    guestSessionId?: string,
  ): Promise<CartResponse> {
    const filter = userId
      ? { user_id: new Types.ObjectId(userId) }
      : { session_id: guestSessionId };

    const cart = await this.cartModel
      .findOne(filter)
      .populate('items.product_id')
      .exec();

    if (!cart) {
      return {
        cartId: '',
        items: [],
        summary: this.getEmptySummary(),
        warnings: [],
      };
    }

    const validatedItems: ValidatedCartItem[] = [];
    const warnings: string[] = [];
    let isCartModified = false;

    for (const item of cart.items) {
      const product = item.product_id as unknown as PopulatedCartProduct;

      if (
        !product ||
        product.status !== ProductStatus.ACTIVE ||
        product.is_deleted
      ) {
        warnings.push(
          `Sản phẩm "${product?.name ?? 'Không xác định'}" đã ngừng kinh doanh.`,
        );
        isCartModified = true;
        continue;
      }

      let availableStock = 0;
      let unitPrice = 0;
      let originalPrice = 0;
      let thumbnail = product.thumbnail ?? '';
      let attributes: unknown[] = [];
      let variantId: string | undefined = undefined;

      if (product.has_variants) {
        const variant = product.variants.find((v) => v.sku === item.sku);
        if (!variant || !variant.active) {
          warnings.push(
            `Phân loại hàng của "${product.name}" không còn tồn tại.`,
          );
          isCartModified = true;
          continue;
        }
        availableStock = variant.stock;
        originalPrice = variant.price;
        unitPrice = variant.sale_price > 0 ? variant.sale_price : variant.price;
        thumbnail = variant.image ?? product.thumbnail ?? '';
        attributes = variant.attributes;
        variantId = (
          variant as unknown as { _id?: Types.ObjectId }
        )._id?.toString();
      } else {
        if (product.sku !== item.sku) {
          warnings.push(`Mã sản phẩm của "${product.name}" không trùng khớp.`);
          isCartModified = true;
          continue;
        }
        availableStock = product.stock;
        originalPrice = product.price;
        unitPrice = product.sale_price > 0 ? product.sale_price : product.price;
      }

      let finalQty = item.quantity;
      if (availableStock < finalQty) {
        finalQty = availableStock;
        warnings.push(
          `Sản phẩm "${product.name} - ${item.sku}" chỉ còn ${availableStock} món.`,
        );
        isCartModified = true;
      }

      if (availableStock === 0) {
        warnings.push(`Sản phẩm "${product.name} - ${item.sku}" đã hết hàng.`);
        finalQty = 0;
      }

      validatedItems.push({
        productId: product._id.toString(),
        variantId: variantId,
        productName: product.name,
        productSlug: product.slug,
        thumbnail: thumbnail,
        sku: item.sku,
        attributes: attributes as Record<string, unknown>[],
        quantity: finalQty,
        stock: availableStock,
        unitPrice: unitPrice,
        originalPrice: originalPrice,
        subtotal: finalQty * unitPrice,
        maxPurchase: product.max_purchase_qty ?? 999,
        isError: finalQty === 0,
        weight: product.weight || 500,
      });
    }

    if (isCartModified) {
      cart.items = cart.items.filter((i) => {
        const p = i.product_id as unknown as PopulatedCartProduct;
        const pIdStr = p?._id?.toString() ?? '';
        return validatedItems.some(
          (v) => v.productId === pIdStr && v.sku === i.sku && v.quantity > 0,
        );
      });

      cart.items.forEach((i) => {
        const p = i.product_id as unknown as PopulatedCartProduct;
        const pIdStr = p?._id?.toString() ?? '';
        const valid = validatedItems.find(
          (v) => v.productId === pIdStr && v.sku === i.sku,
        );
        if (valid) i.quantity = valid.quantity;
      });
      await cart.save();
    }

    const summary = await this.calculateSummary(
      validatedItems,
      userId,
      cart.applied_coupon ?? undefined,
    );

    return {
      cartId: cart._id.toString(),
      items: validatedItems,
      summary,
      warnings,
    };
  }

  async clearCart(userId: string | null, guestSessionId: string) {
    const filter = userId
      ? { user_id: new Types.ObjectId(userId) }
      : { session_id: guestSessionId };

    const cart = await this.cartModel.findOne(filter);
    if (cart) {
      const itemCountBeforeClear = cart.items.length;
      cart.items = [];
      cart.set('applied_coupon', null);

      await cart.save();

      if (itemCountBeforeClear > 0) {
        await this.auditLogsService.log({
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

    const product = await this.productModel.findById(dto.productId);
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    if (!product.has_variants) {
      throw new BadRequestException(
        'Sản phẩm này không có tùy chọn phân loại để đổi',
      );
    }

    const oldItemIndex = cart.items.findIndex(
      (i) =>
        i.product_id.toString() === dto.productId &&
        i.sku === dto.oldVariantSku,
    );
    if (oldItemIndex === -1)
      throw new NotFoundException('Sản phẩm không có trong giỏ');

    const qtyToMove = cart.items[oldItemIndex].quantity;

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
      const newTotalQty = cart.items[existingNewItemIndex].quantity + qtyToMove;

      if (newTotalQty > newVariant.stock) {
        throw new BadRequestException(
          `Không thể gộp dữ liệu. Tổng số lượng (${newTotalQty}) vượt quá tồn kho hiện tại.`,
        );
      }
      cart.items[existingNewItemIndex].quantity = newTotalQty;
      cart.items.splice(oldItemIndex, 1);
    } else {
      cart.items[oldItemIndex].sku = dto.newVariantSku;
    }

    await cart.save();

    await this.auditLogsService.log({
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

    return this.getCart(userId, dto.guestSessionId);
  }

  async addToCart(
    userId: string | null,
    dto: AddToCartDto,
    ip: string,
    userAgent: string,
  ) {
    const session: ClientSession = await this.connection.startSession();
    session.startTransaction();

    try {
      const product = await this.productModel
        .findById(dto.productId)
        .session(session);

      if (!product || product.status !== ProductStatus.ACTIVE) {
        throw new NotFoundException(
          'Sản phẩm không tồn tại hoặc ngừng kinh doanh',
        );
      }

      if (product.is_member_only && !userId) {
        throw new BadRequestException('Vui lòng đăng nhập để mua sản phẩm này');
      }

      let availableStock = 0;

      if (product.has_variants) {
        const variant = product.variants.find((v) => v.sku === dto.variantSku);
        if (!variant)
          throw new BadRequestException('Phân loại hàng không hợp lệ');
        if (!variant.active || variant.stock === 0)
          throw new BadRequestException('Sản phẩm này tạm thời hết hàng');
        availableStock = variant.stock;
      } else {
        if (product.sku !== dto.variantSku)
          throw new BadRequestException('Mã SKU không hợp lệ');
        if (product.stock === 0)
          throw new BadRequestException('Sản phẩm này tạm thời hết hàng');
        availableStock = product.stock;
      }

      if (dto.quantity > availableStock) {
        throw new BadRequestException(`Kho chỉ còn ${availableStock} sản phẩm`);
      }

      const filter = userId
        ? { user_id: new Types.ObjectId(userId) }
        : { session_id: dto.guestSessionId };

      let cart = await this.cartModel.findOne(filter).session(session);

      if (!cart) {
        cart = new this.cartModel({
          ...filter,
          items: [],
        });
      }

      const itemIndex = cart.items.findIndex(
        (i) =>
          i.product_id.toString() === dto.productId && i.sku === dto.variantSku,
      );

      let newQuantity = dto.quantity;

      if (itemIndex > -1) {
        newQuantity += cart.items[itemIndex].quantity;
        cart.items[itemIndex].quantity = newQuantity;
        cart.items[itemIndex].selected_at = new Date();
      } else {
        if (cart.items.length >= 50) {
          throw new BadRequestException('Giỏ hàng đã đầy, tối đa 50 sản phẩm');
        }

        cart.items.push({
          product_id: new Types.ObjectId(dto.productId),
          sku: dto.variantSku,
          quantity: dto.quantity,
          selected_at: new Date(),
        });
      }

      if (newQuantity > availableStock) {
        throw new BadRequestException(
          `Tổng số lượng mua vượt quá tồn kho thực tế. Kho đang còn ${availableStock}, giỏ hàng đang có ${newQuantity}.`,
        );
      }

      if (product.max_purchase_qty && product.max_purchase_qty > 0) {
        if (newQuantity > product.max_purchase_qty) {
          throw new BadRequestException(
            `Sản phẩm này giới hạn mua tối đa ${product.max_purchase_qty} cái.`,
          );
        }

        const minQty = product.min_purchase_qty || 1;
        if (newQuantity < minQty) {
          throw new BadRequestException(
            `Yêu cầu mua tối thiểu ${minQty} sản phẩm.`,
          );
        }
      }

      await cart.save({ session });
      await session.commitTransaction();

      await this.auditLogsService.log({
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
      await session.endSession();
    }
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

    if (product.max_purchase_qty && dto.quantity > product.max_purchase_qty) {
      throw new BadRequestException(
        `Sản phẩm này giới hạn mua tối đa ${product.max_purchase_qty} cái.`,
      );
    }

    let availableStock = 0;

    if (product.has_variants) {
      const variant = product.variants.find((v) => v.sku === dto.variantSku);
      if (!variant) throw new NotFoundException('Biến thể không tồn tại');
      availableStock = variant.stock;
    } else {
      if (product.sku !== dto.variantSku)
        throw new NotFoundException('Mã SKU không hợp lệ');
      availableStock = product.stock;
    }

    if (availableStock < dto.quantity) {
      throw new BadRequestException(`Kho chỉ còn ${availableStock} sản phẩm`);
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

  async mergeGuestCart(
    userId: string,
    guestSessionId: string,
    ip: string,
    userAgent: string,
  ) {
    if (!guestSessionId) {
      return this.getCart(userId, undefined);
    }

    const guestCart = await this.cartModel.findOne({
      session_id: guestSessionId,
    });

    if (!guestCart || guestCart.items.length === 0) {
      return this.getCart(userId, undefined);
    }

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

      let availableStock = 0;

      if (product.has_variants) {
        const variant = product.variants.find((v) => v.sku === guestItem.sku);
        if (!variant || !variant.active || variant.stock <= 0) continue;
        availableStock = variant.stock;
      } else {
        if (product.sku !== guestItem.sku || product.stock <= 0) continue;
        availableStock = product.stock;
      }

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

      if (finalQuantity > availableStock) {
        finalQuantity = availableStock;
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
    await this.cartModel.deleteOne({ _id: guestCart._id }).exec();

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
