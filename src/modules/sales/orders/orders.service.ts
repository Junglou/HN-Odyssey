import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection, Types } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Order } from './schemas/order.schema';
import { Cart } from '../cart/schemas/cart.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { Product } from 'src/modules/products/catalog/schemas/product.schema';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { Department } from 'src/common/enums/department.enum';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectConnection() private connection: Connection,
    @InjectRedis() private readonly redis: Redis,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // 1. Thêm Helper giả lập tính Voucher (Hoặc Inject VoucherService thật vào đây)
  private async applyVoucher(
    originalTotal: number,
    voucherCode?: string,
  ): Promise<{ finalTotal: number; discount: number }> {
    if (!voucherCode) return { finalTotal: originalTotal, discount: 0 };

    // [TODO] Gọi VoucherService.validate(voucherCode, originalTotal)
    // Giả lập logic: Mã "WELCOME" giảm 10%, tối đa 50k
    let discount = 0;
    if (voucherCode === 'WELCOME') {
      discount = Math.min(originalTotal * 0.1, 50000);
    }

    // Đảm bảo không giảm quá giá trị đơn hàng
    return {
      finalTotal: Math.max(0, originalTotal - discount),
      discount: discount,
    };
  }

  // 1. INIT BUY NOW SESSION (Bắt buộc chạy trước khi tạo đơn Mua ngay)
  async createBuyNowSession(data: {
    productId: string;
    variantSku: string;
    quantity: number;
    userId?: string;
    guestSessionId?: string;
  }) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      // 1. XÁC ĐỊNH ĐỐI TƯỢNG (User hay Guest)
      const queryCriteria: any = {
        status: 'TEMPORARY',
      };

      let hasIdentity = false;

      if (data.userId) {
        queryCriteria.user_id = new Types.ObjectId(data.userId);
        hasIdentity = true;
      } else if (data.guestSessionId) {
        queryCriteria.session_id = data.guestSessionId;
        hasIdentity = true;
      }
      // [FIX AC5] Xóa bỏ phiên "Mua ngay" cũ (Áp dụng cả User & Guest)
      if (hasIdentity) {
        const oldTempOrders = await this.orderModel
          .find(queryCriteria)
          .session(session);

        if (oldTempOrders.length > 0) {
          for (const oldOrder of oldTempOrders) {
            // A. Hoàn tồn kho
            for (const item of oldOrder.items) {
              await this.productModel
                .updateOne(
                  { _id: item.product_id, 'variants.sku': item.sku },
                  { $inc: { 'variants.$.stock': item.quantity } },
                )
                .session(session);
            }
            // B. Hủy đơn cũ
            oldOrder.status = 'CANCELLED';
            oldOrder.cancel_reason = 'Override by new Buy Now session';
            await oldOrder.save({ session });
          }
        }
      }
      // 2. TẠO PHIÊN MUA NGAY MỚI
      const product = await this.productModel
        .findById(data.productId)
        .session(session);

      if (!product || product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException('Sản phẩm không khả dụng');
      }

      //Check Min Purchase Qty (US.AC13)
      const minQty = product.min_purchase_qty || 1;
      if (data.quantity < minQty) {
        throw new BadRequestException(
          `Sản phẩm này bắt buộc mua tối thiểu ${minQty} cái.`,
        );
      }

      //Check Member Only
      if (product.is_member_only && !data.userId) {
        throw new BadRequestException('Sản phẩm này chỉ dành cho thành viên');
      }

      //Check giới hạn mua
      if (product.max_purchase_qty && product.max_purchase_qty > 0) {
        if (data.quantity > product.max_purchase_qty) {
          throw new BadRequestException(
            `Sản phẩm này chỉ được mua tối đa ${product.max_purchase_qty} cái/lần.`,
          );
        }
      }

      const variant = product.variants.find((v) => v.sku === data.variantSku);
      if (!variant || !variant.active)
        throw new BadRequestException('Biến thể không hợp lệ');

      //Check tồn kho
      if (variant.stock < data.quantity) {
        throw new BadRequestException(`Hết hàng. Kho chỉ còn ${variant.stock}`);
      }

      //Trừ kho tạm thời (Hard Reserve)
      await this.productModel
        .updateOne(
          { _id: product._id, 'variants.sku': data.variantSku },
          { $inc: { 'variants.$.stock': -data.quantity } },
        )
        .session(session);

      //Tạo đơn tạm
      const holdExpiresAt = new Date(Date.now() + 15 * 60000);

      const tempOrder = new this.orderModel({
        order_code: `BUYNOW-${Date.now()}`,
        user_id: data.userId ? new Types.ObjectId(data.userId) : null,
        session_id: data.userId ? undefined : data.guestSessionId,
        items: [
          {
            product_id: product._id,
            sku: variant.sku,
            product_name: product.name,
            price: variant.sale_price > 0 ? variant.sale_price : variant.price,
            quantity: data.quantity,
          },
        ],
        total_amount:
          (variant.sale_price > 0 ? variant.sale_price : variant.price) *
          data.quantity,
        status: 'TEMPORARY',
        hold_expires_at: holdExpiresAt,
        payment: { method: 'UNKNOWN', status: 'PENDING' },
      });

      await tempOrder.save({ session });
      await session.commitTransaction();

      // Lưu Token vào Redis
      const token = `checkout_token_${tempOrder._id}`;
      await this.redis.set(token, tempOrder._id.toString(), 'EX', 900);

      await this.auditLogsService.log({
        action: 'INIT_BUY_NOW_SESSION',
        collection_name: 'orders',
        department: Department.SALE_MARKETING,
        actor_id: data.userId || undefined,
        target_id: tempOrder._id,
        detail: {
          product_id: data.productId,
          quantity: data.quantity,
          session_id: data.guestSessionId,
          hold_expires_at: holdExpiresAt,
        },
      });

      //Lấy danh sách Upsell (Bán chéo) - AC15
      const upsellProducts = await this.productModel
        .find({
          categories: { $in: product.categories },
          _id: { $ne: product._id },
          status: ProductStatus.ACTIVE,
          stock: { $gt: 0 },
        })
        .sort({ price: 1 })
        .limit(2)
        .select('name thumbnail price sale_price slug')
        .lean();

      return { checkoutSessionToken: token, upsell_products: upsellProducts };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // 2. CREATE ORDER
  async createOrder(
    userId: string | null,
    dto: CreateOrderDto,
    ip: string,
    userAgent: string,
  ) {
    //MUA NGAY (Đã giữ hàng trước đó)
    if (dto.source === 'BUY_NOW') {
      if (!dto.checkoutSessionToken)
        throw new BadRequestException('Thiếu Token');

      const orderId = await this.redis.get(dto.checkoutSessionToken);
      if (!orderId)
        throw new BadRequestException(
          'Phiên mua hàng đã hết hạn hoặc không tồn tại',
        );

      const order = await this.orderModel.findById(orderId);
      // Nếu order không còn là TEMPORARY (VD: Cron job đã hủy do hết hạn), báo lỗi
      if (!order || order.status !== 'TEMPORARY') {
        throw new BadRequestException(
          'Đơn hàng không hợp lệ hoặc đã hết hạn giữ hàng',
        );
      }

      const { finalTotal, discount } = await this.applyVoucher(
        order.total_amount,
        dto.voucherCode,
      );

      // Cập nhật thông tin giao hàng & Chuyển trạng thái
      order.shipping_info = dto.shippingInfo;
      order.payment.method = dto.paymentMethod;
      order.status = 'PENDING';

      //Cập nhật giá sau giảm
      order.total_amount = finalTotal;
      order['discount_amount'] = discount;
      order['voucher_code'] = dto.voucherCode || '';

      await order.save();
      await this.redis.del(dto.checkoutSessionToken);

      await this.logCreateOrder(userId, order, dto.source, ip, userAgent);
      return order;
    }

    //MUA TỪ GIỎ HÀNG (Cần Transaction)
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const cartQuery = userId
        ? { user_id: new Types.ObjectId(userId) }
        : { session_id: dto.guestSessionId };

      const cart = await this.cartModel.findOne(cartQuery).session(session);
      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Giỏ hàng trống');
      }

      //Khai báo kiểu any[] rõ ràng để TypeScript không báo lỗi
      const orderItems: any[] = [];
      let totalAmount = 0;

      for (const item of cart.items) {
        const product = await this.productModel
          .findById(item.product_id)
          .session(session);

        if (!product || product.status !== ProductStatus.ACTIVE) {
          throw new BadRequestException(`Sản phẩm ${item.sku} không khả dụng`);
        }

        const variant = product.variants.find((v) => v.sku === item.sku);
        if (!variant) throw new BadRequestException(`Biến thể ${item.sku} lỗi`);
        if (!variant.active)
          throw new BadRequestException(`Phân loại ${item.sku} ngừng bán`);

        // Member check
        if (product.is_member_only && !userId) {
          throw new BadRequestException(
            `Sản phẩm ${product.name} chỉ dành cho thành viên.`,
          );
        }

        // Limit check
        if (
          product.max_purchase_qty &&
          item.quantity > product.max_purchase_qty
        ) {
          throw new BadRequestException(
            `Sản phẩm ${product.name} giới hạn ${product.max_purchase_qty} cái/đơn.`,
          );
        }

        // Stock check
        if (variant.stock < item.quantity) {
          throw new BadRequestException(
            `Sản phẩm ${product.name} (${item.sku}) chỉ còn ${variant.stock}`,
          );
        }

        const finalPrice =
          variant.sale_price > 0 ? variant.sale_price : variant.price;

        orderItems.push({
          product_id: product._id,
          sku: variant.sku,
          product_name: product.name,
          price: finalPrice,
          quantity: item.quantity,
        });

        totalAmount += finalPrice * item.quantity;

        // Trừ kho ngay lập tức
        await this.productModel
          .updateOne(
            { _id: product._id, 'variants.sku': item.sku },
            { $inc: { 'variants.$.stock': -item.quantity } },
          )
          .session(session);
      }

      const newOrder = new this.orderModel({
        order_code: `ORD-${Date.now()}`,
        user_id: userId ? new Types.ObjectId(userId) : null,
        items: orderItems,
        shipping_info: dto.shippingInfo,
        payment: { method: dto.paymentMethod, status: 'PENDING' },
        total_amount: totalAmount,
        status: 'PENDING',
        hold_expires_at: new Date(Date.now() + 15 * 60000), // Vẫn set timeout 15p cho đơn thường
      });

      await this.cartModel.deleteOne({ _id: cart._id }).session(session);
      await newOrder.save({ session });
      await session.commitTransaction();

      await this.logCreateOrder(userId, newOrder, dto.source, ip, userAgent);
      return newOrder;
    } catch (error) {
      await session.abortTransaction();
      await this.auditLogsService.log({
        action: 'CREATE_ORDER_FAILED',
        collection_name: 'orders',
        actor_id: userId,
        department: Department.SALE_MARKETING,
        detail: { error: error.message },
        is_success: false,
        ip: ip,
        user_agent: userAgent,
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  // 3. UPDATE STATUS (Admin/System)
  async updateStatus(
    orderId: string,
    status: string,
    adminId: string,
    ip: string,
    userAgent: string,
  ) {
    const validStatuses = [
      'PENDING',
      'CONFIRMED',
      'SHIPPING',
      'COMPLETED',
      'CANCELLED',
    ];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }

    //Nếu Hủy đơn thủ công -> Phải hoàn tồn kho
    if (status === 'CANCELLED') {
      const orderToCheck = await this.orderModel.findById(orderId);

      // Chỉ hoàn kho nếu đơn hàng chưa từng bị hủy trước đó
      if (orderToCheck && orderToCheck.status !== 'CANCELLED') {
        for (const item of orderToCheck.items) {
          await this.productModel.updateOne(
            { _id: item.product_id, 'variants.sku': item.sku },
            { $inc: { 'variants.$.stock': item.quantity } },
          );
        }
      }
    }

    const updateData: any = { status };
    if (status === 'COMPLETED') updateData['payment.status'] = 'PAID';
    if (status === 'CANCELLED') updateData['payment.status'] = 'CANCELLED';

    const order = await this.orderModel.findByIdAndUpdate(
      orderId,
      { $set: updateData },
      { new: true },
    );

    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    // Audit Log
    await this.auditLogsService.log({
      action: 'UPDATE_ORDER_STATUS',
      collection_name: 'orders',
      actor_id: adminId,
      target_id: order._id,
      department: Department.SALE_MARKETING,
      detail: {
        new_status: status,
        order_code: order.order_code,
      },
      ip: ip,
      user_agent: userAgent,
    });

    return order;
  }

  // Helper
  private async logCreateOrder(userId, order, source, ip, userAgent) {
    await this.auditLogsService.log({
      action: 'CREATE_ORDER',
      collection_name: 'orders',
      actor_id: userId,
      target_id: order._id,
      department: Department.SALE_MARKETING,
      detail: {
        order_code: order.order_code,
        total: order.total_amount,
        item_count: order.items.length,
        source: source,
        // payment_method: order.payment?.method, // Log thêm phương thức thanh toán
      },
      is_success: true,
      ip: ip,
      user_agent: userAgent,
    });
  }
}
