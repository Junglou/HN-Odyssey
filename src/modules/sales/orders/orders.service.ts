import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection, Types, FilterQuery } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Order } from './schemas/order.schema';
import { Cart } from '../cart/schemas/cart.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { Product } from 'src/modules/products/catalog/schemas/product.schema';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { Department } from 'src/common/enums/department.enum';
import { FilterOrderDto } from './dto/filter-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { EmailService } from 'src/modules/notifications/channels/email.service';
import { PdfService } from './pdf.service';
import { PromotionEngineService } from 'src/modules/marketing/promotions/promotion-engine.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectConnection() private connection: Connection,
    @InjectRedis() private readonly redis: Redis,
    private readonly auditLogsService: AuditLogsService,
    private readonly emailService: EmailService,
    private readonly pdfService: PdfService,
    private readonly promotionEngine: PromotionEngineService,
  ) {}

  // US.121: DANH SÁCH ĐƠN HÀNG
  async findAll(query: FilterOrderDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const { search, status, fromDate, toDate, sort } = query;

    const pipeline: any[] = [];

    // 1. GIAI ĐOẠN SEARCH (Quan trọng: $search phải luôn đứng đầu pipeline)
    if (search && search.trim().length > 0) {
      pipeline.push({
        $search: {
          index: 'default', // Tên index tạo trên Atlas
          compound: {
            should: [
              {
                text: {
                  query: search,
                  path: 'order_code',
                  score: { boost: { value: 5 } }, // Ưu tiên khớp mã đơn nhất
                },
              },
              {
                text: {
                  query: search,
                  path: ['shipping_info.phone', 'guest_info.phone'],
                  score: { boost: { value: 3 } }, // Ưu tiên SĐT
                },
              },
              {
                text: {
                  query: search,
                  path: 'shipping_info.name',
                  fuzzy: { maxEdits: 1 }, // Cho phép sai chính tả tên nhẹ
                },
              },
            ],
            minimumShouldMatch: 1,
          },
        },
      });
    }

    // 2. GIAI ĐOẠN MATCH (Lọc Status, Date...)
    const matchStage: any = { status: { $ne: 'TEMPORARY' } };

    if (status) matchStage.status = status;
    if (fromDate || toDate) {
      matchStage.createdAt = {};
      if (fromDate) matchStage.createdAt.$gte = new Date(fromDate);
      if (toDate) matchStage.createdAt.$lte = new Date(toDate);
    }

    // Nếu không search thì push matchStage bình thường
    // Nếu có search, matchStage sẽ lọc TRÊN KẾT QUẢ search -> Hiệu năng cực cao
    pipeline.push({ $match: matchStage });

    // 3. GIAI ĐOẠN SORT
    let sortStage: any = {};
    if (sort) {
      const [key, val] = sort.split(':');
      sortStage[key] = val === 'desc' ? -1 : 1;
    } else {
      // Logic cũ: Priority lên đầu
      sortStage = { sort_weight: 1, createdAt: -1 };
    }

    const skip = (page - 1) * limit;

    // 4. GIAI ĐOẠN FACET
    pipeline.push({
      $facet: {
        data: [
          {
            $addFields: {
              sort_weight: {
                $cond: {
                  if: { $eq: ['$status', 'PRIORITY'] },
                  then: 1,
                  else: 2,
                },
              },
            },
          },
          { $sort: sortStage },
          { $skip: skip },
          { $limit: limit },
          { $project: { sort_weight: 0 } },
        ],
        totalCount: [{ $count: 'count' }],
      },
    });

    const [result] = await this.orderModel.aggregate(pipeline);

    const data = result.data;
    const total = result.totalCount[0]?.count || 0;

    return {
      data,
      meta: {
        total,
        page,
        last_page: Math.ceil(total / limit),
      },
    };
  }

  //US.122: CHI TIẾT ĐƠN HÀNG
  async findOne(id: string) {
    const order = await this.orderModel
      .findById(id)
      .populate('user_id', 'name email phone avatar first_name last_name')
      .exec();
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    return order;
  }

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
      const rawDiscount = originalTotal * 0.1;
      discount = Math.min(Math.round(rawDiscount), 50000);
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
      //Xóa bỏ phiên "Mua ngay" cũ (Áp dụng cả User & Guest)
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

      const rawItem = {
        productId: product._id,
        sku: variant.sku,
        quantity: data.quantity,
        unitPrice: variant.sale_price > 0 ? variant.sale_price : variant.price,
      };

      const { items: processedItems } = await this.promotionEngine.applyCombos([
        rawItem,
      ]);
      const finalItem = processedItems[0];
      const finalPrice = finalItem.discountedPrice || finalItem.unitPrice;

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
            price: finalPrice,
            quantity: data.quantity,
          },
        ],
        total_amount: finalPrice * data.quantity,
        discount_amount: (rawItem.unitPrice - finalPrice) * data.quantity,
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
        department: Department.SALES,
        actor_id: data.userId || undefined,
        target_id: tempOrder._id,
        detail: {
          product_id: data.productId,
          quantity: data.quantity,
          session_id: data.guestSessionId,
          hold_expires_at: holdExpiresAt,
        },
      });

      //Lấy danh sách Upsell - AC15
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
    // TRƯỜNG HỢP 1: MUA NGAY (BUY_NOW)
    if (dto.source === 'BUY_NOW') {
      if (!dto.checkoutSessionToken)
        throw new BadRequestException('Thiếu Token');

      const orderId = await this.redis.get(dto.checkoutSessionToken);
      if (!orderId)
        throw new BadRequestException(
          'Phiên mua hàng đã hết hạn hoặc không tồn tại',
        );

      const order = await this.orderModel.findById(orderId);

      if (!order || order.status !== 'TEMPORARY') {
        throw new BadRequestException(
          'Đơn hàng không hợp lệ hoặc đã hết hạn giữ hàng',
        );
      }

      const { finalTotal, discount } = await this.applyVoucher(
        order.total_amount,
        dto.voucherCode,
      );

      order.shipping_info = dto.shippingInfo;
      if (!order.guest_info) {
        order.guest_info = {
          name: dto.shippingInfo.name,
          phone: dto.shippingInfo.phone,
          email: dto.shippingInfo.email,
        };
      } else if (dto.shippingInfo.email) {
        order.guest_info.email = dto.shippingInfo.email;
      }
      order.payment.method = dto.paymentMethod;
      order.status = 'PENDING';
      order.total_amount = finalTotal;
      order['discount_amount'] = discount;
      order['voucher_code'] = dto.voucherCode || '';
      order.timeline.push({
        status: 'PENDING',
        timestamp: new Date(),
        actor: 'Khách hàng (Web)',
        note: 'Đơn hàng được tạo thành công (Mua ngay)',
      });

      await order.save();
      await this.redis.del(dto.checkoutSessionToken);

      await this.logCreateOrder(userId, order, dto.source, ip, userAgent);
      return order;
    }

    // TRƯỜNG HỢP 2: MUA TỪ GIỎ HÀNG (CART)
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 1. Tạo Query tìm giỏ hàng chuẩn xác
      const cartQuery: any = {};

      if (userId) {
        cartQuery.user_id = new Types.ObjectId(userId);
      } else if (dto.guestSessionId) {
        cartQuery.session_id = dto.guestSessionId;
      } else {
        throw new BadRequestException(
          'Không xác định được danh tính người mua (Thiếu Guest ID hoặc User ID)',
        );
      }

      // 2. Tìm giỏ hàng
      const cart = await this.cartModel.findOne(cartQuery).session(session);

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new BadRequestException('Giỏ hàng trống hoặc không tồn tại');
      }

      const orderItems: any[] = [];
      // Biến này chỉ dùng để check giá gốc tạm thời, sẽ được tính lại sau khi chạy Combo
      let tempTotalAmount = 0;

      // 3. Duyệt item và trừ tồn kho (GIỮ NGUYÊN LOGIC VALIDATION & STOCK)
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

        if (product.is_member_only && !userId) {
          throw new BadRequestException(
            `Sản phẩm ${product.name} chỉ dành cho thành viên.`,
          );
        }

        if (
          product.max_purchase_qty &&
          item.quantity > product.max_purchase_qty
        ) {
          throw new BadRequestException(
            `Sản phẩm ${product.name} giới hạn ${product.max_purchase_qty} cái/đơn.`,
          );
        }

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
          original_price: finalPrice, 
        });

        tempTotalAmount += finalPrice * item.quantity;

        // Trừ kho
        await this.productModel
          .updateOne(
            { _id: product._id, 'variants.sku': item.sku },
            { $inc: { 'variants.$.stock': -item.quantity } },
          )
          .session(session);
      }

      const itemsForPromo = orderItems.map((i) => ({
        productId: i.product_id,
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: i.price, // Giá gốc/sale lẻ hiện tại
      }));

      // Gọi PromotionEngine để xem có Combo nào áp dụng không (Buy X Get Y, v.v.)
      const { items: discountedItems, totalDiscount } =
        await this.promotionEngine.applyCombos(itemsForPromo);

      // Cập nhật lại giá trong orderItems dựa trên kết quả trả về
      let finalOrderTotal = 0;

      for (const item of orderItems) {
        // Tìm item tương ứng trong danh sách đã tính giảm giá
        const promoItem = discountedItems.find(
          (d) =>
            d.productId.toString() === item.product_id.toString() &&
            d.sku === item.sku,
        );

        if (promoItem) {
          // Lấy giá đã giảm (nếu có), nếu không thì giữ nguyên unitPrice
          const actualPrice = promoItem.discountedPrice || promoItem.unitPrice;
          item.price = actualPrice; // Cập nhật giá bán thực tế vào đơn hàng

          // (Optional)có thể lưu thêm field: applied_combo: promoItem.appliedCombo
        }

        // Cộng dồn tổng tiền chính xác
        finalOrderTotal += item.price * item.quantity;
      }

      // 4. Tạo đơn hàng mới
      const newOrder = new this.orderModel({
        order_code: `ORD-${Date.now()}`,
        user_id: userId ? new Types.ObjectId(userId) : null,
        guest_info: dto.shippingInfo.email
          ? {
              name: dto.shippingInfo.name,
              phone: dto.shippingInfo.phone,
              email: dto.shippingInfo.email,
            }
          : undefined,
        items: orderItems,
        shipping_info: dto.shippingInfo,
        payment: { method: dto.paymentMethod, status: 'PENDING' },
        total_amount: finalOrderTotal, 
        discount_amount: totalDiscount,
        status: 'PENDING',
        hold_expires_at: new Date(Date.now() + 15 * 60000),
        timeline: [
          {
            status: 'PENDING',
            timestamp: new Date(),
            actor: 'Khách hàng (Web)',
            note: 'Đơn hàng được tạo từ Giỏ hàng',
          },
        ],
      });

      // 5. Xóa giỏ hàng sau khi tạo đơn thành công
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
        department: Department.SALES,
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
      department: Department.SALES,
      detail: {
        new_status: status,
        order_code: order.order_code,
      },
      ip: ip,
      user_agent: userAgent,
    });

    return order;
  }

  //US.123: CẬP NHẬT TRẠNG THÁI (STATE MACHINE)
  async updateStatusAdvanced(
    id: string,
    dto: UpdateOrderStatusDto,
    actorId: string,
    actorName: string,
    ip: string,
    userAgent: string,
  ) {
    const session = await this.connection.startSession();
    session.startTransaction(); // 1. Bắt đầu giao dịch

    try {
      // 2. Truyền session vào query tìm kiếm
      const order = await this.orderModel.findById(id).session(session);
      if (!order) throw new NotFoundException('Đơn hàng không tìm thấy');

      const oldStatus = order.status;
      const newStatus = dto.status;

      // AC6: Chặn sửa khi đã đóng
      if (['COMPLETED', 'CANCELLED'].includes(oldStatus) && !dto.is_override) {
        throw new BadRequestException(
          'Đơn hàng đã đóng. Cần quyền Ghi đè (Override) để mở lại.',
        );
      }

      // AC1 & AC4: Validate State Transition với Logic Ghi đè an toàn
      if (dto.is_override) {
        // Nếu chọn Ghi đè, BẮT BUỘC phải có lý do
        if (!dto.reason || dto.reason.trim() === '') {
          throw new BadRequestException(
            'Bắt buộc nhập lý do khi thực hiện Ghi đè quy trình (Override Workflow).',
          );
        }
        // Bỏ qua validateStateTransition -> Cho phép nhảy cóc
      } else {
        // Nếu đi luồng thường, bắt buộc phải đúng quy trình
        this.validateStateTransition(oldStatus, newStatus);
      }

      // AC2: Xử lý Ưu tiên
      if (newStatus === 'PRIORITY' && oldStatus !== 'PENDING') {
        throw new BadRequestException(
          'Chỉ đơn chờ xử lý mới được chuyển sang Ưu tiên',
        );
      }

      // AC5: Ràng buộc dữ liệu khi vận chuyển
      if (newStatus === 'SHIPPING') {
        if (!dto.shipping_provider || !dto.tracking_code) {
          throw new BadRequestException(
            'Vui lòng nhập Đơn vị vận chuyển và Mã vận đơn',
          );
        }
        order.shipping_info.provider = dto.shipping_provider;
        order.shipping_info.tracking_code = dto.tracking_code;
      }

      // AC3: Xử lý Hủy
      if (newStatus === 'CANCELLED' && oldStatus !== 'CANCELLED') {
        await this.restoreStock(order, session);
        order.cancel_reason = dto.reason || 'Hủy bởi nhân viên';
      }

      // 2. Trường hợp KHÔI PHỤC ĐƠN ĐÃ HỦY
      if (oldStatus === 'CANCELLED' && newStatus !== 'CANCELLED') {
        // Kiểm tra xem còn hàng để trừ không
        for (const item of order.items) {
          const product = await this.productModel
            .findById(item.product_id)
            .session(session);
          if (!product) {
            throw new BadRequestException(
              `Không thể khôi phục đơn: Sản phẩm ${item.product_name} đã bị xóa vĩnh viễn khỏi hệ thống.`,
            );
          }
          const variant = product.variants.find((v) => v.sku === item.sku);

          if (!variant || variant.stock < item.quantity) {
            throw new BadRequestException(
              `Không thể khôi phục đơn. Sản phẩm ${item.product_name} (${item.sku}) không đủ tồn kho (Hiện có: ${variant ? variant.stock : 0}).`,
            );
          }
          // Thực hiện trừ kho
          await this.productModel
            .updateOne(
              { _id: item.product_id, 'variants.sku': item.sku },
              { $inc: { 'variants.$.stock': -item.quantity } },
            )
            .session(session);
        }
      }
      // Cập nhật
      order.status = newStatus;
      if (newStatus === 'COMPLETED') order.payment.status = 'PAID';

      // Nếu khôi phục đơn hủy, reset lý do hủy
      if (oldStatus === 'CANCELLED' && newStatus !== 'CANCELLED') {
        order.cancel_reason = undefined;
      }
      // AC4 & AC7: Ghi Timeline & Internal Note
      if (dto.note) order.internal_note = dto.note;

      order.timeline.push({
        status: newStatus,
        timestamp: new Date(),
        actor: actorName,
        note:
          dto.reason || dto.note || `Chuyển từ ${oldStatus} sang ${newStatus}`,
      });

      // 3. Lưu với session
      await order.save({ session });

      // 4. Xác nhận giao dịch thành công
      await session.commitTransaction();

      // Ghi log sau khi commit thành công để đảm bảo dữ liệu đã an toàn
      await this.auditLogsService.log({
        action: dto.is_override
          ? 'OVERRIDE_ORDER_STATUS'
          : 'UPDATE_ORDER_STATUS',
        collection_name: 'orders',
        actor_id: actorId,
        target_id: order._id,
        department: Department.SALES,
        detail: {
          order_code: order.order_code,
          old_status: oldStatus,
          new_status: newStatus,
          reason: dto.reason || null,
          is_override: dto.is_override || false,
          note: dto.note || null,
          tracking_code: dto.tracking_code || null,
        },
        ip: ip,
        user_agent: userAgent,
        is_success: true,
      });

      return order;
    } catch (error) {
      // 5. Nếu có lỗi, hoàn tác mọi thay đổi (kể cả hoàn kho)
      await session.abortTransaction();
      throw error;
    } finally {
      // 6. Kết thúc phiên làm việc
      session.endSession();
    }
  }

  //US.124: IN HÓA ĐƠN / PHIẾU GIAO HÀNG
  async generatePrintData(id: string, type: 'INVOICE' | 'PACKING_SLIP') {
    const order = await this.findOne(id);

    // AC5: Ràng buộc trạng thái
    if (
      type === 'INVOICE' &&
      ['PENDING', 'CANCELLED', 'TEMPORARY'].includes(order.status)
    ) {
      throw new BadRequestException('Đơn hàng chưa đủ điều kiện xuất hóa đơn');
    }

    // AC8: Tăng biến đếm số lần in
    // Chỉ tăng khi in Hóa đơn (Invoice), phiếu giao hàng có thể in lại thoải mái tùy nghiệp vụ
    if (type === 'INVOICE') {
      order.print_count = (order.print_count || 0) + 1;
      await order.save();
    }

    // Trả về data cấu trúc để Frontend render PDF hoặc dùng thư viện tạo PDF tại đây
    return {
      type,
      print_date: new Date(),
      is_copy: order.print_count > 1, // Nếu in > 1 lần là bản sao
      order_info: {
        code: order.order_code,
        created_at: order['createdAt'],
        customer: order.shipping_info,
      },
      items: order.items.map((i) => ({
        name: i.product_name,
        qty: i.quantity,
        // Nếu là Packing Slip thì ẩn giá (AC2)
        price: type === 'INVOICE' ? i.price : undefined,
        total: type === 'INVOICE' ? i.price * i.quantity : undefined,
      })),
      financials:
        type === 'INVOICE'
          ? {
              subtotal: order.total_amount + order.discount_amount,
              discount: order.discount_amount,
              total: order.total_amount,
            }
          : undefined,
    };
  }

  // 2. Thêm hàm gửi Email (AC3)
  async sendInvoiceEmail(id: string) {
    const order = await this.orderModel.findById(id).populate('user_id');
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const recipientEmail =
      order.shipping_info?.email || // 1. Tìm trong thông tin giao hàng
      order.guest_info?.email || // 2. Tìm trong thông tin khách vãng lai
      (order.user_id as any)?.email;
    if (!recipientEmail) {
      throw new BadRequestException(
        'Đơn hàng này không có địa chỉ email liên kết',
      );
    }

    try {
      // 1. Tạo file PDF từ PdfService
      const pdfBuffer = await this.pdfService.generateInvoice(order);

      // 2. Gửi mail kèm Buffer
      await this.emailService.sendInvoice(recipientEmail, order, pdfBuffer);

      // 3. Log lại
      await this.auditLogsService.log({
        action: 'SEND_INVOICE_EMAIL',
        collection_name: 'orders',
        target_id: order._id,
        department: Department.SALES,
        detail: { email: recipientEmail, has_attachment: true },
        is_success: true,
      });

      return {
        success: true,
        message: `Đã gửi hóa đơn (kèm PDF) đến ${recipientEmail}`,
      };
    } catch (error) {
      console.error('Lỗi gửi mail/tạo PDF:', error);
      throw new BadRequestException('Gửi email thất bại: ' + error.message);
    }
  }

  // 3. Thêm hàm lấy dữ liệu in hàng loạt (AC4)
  async generateBulkPrintData(ids: string[], type: 'INVOICE' | 'PACKING_SLIP') {
    const results: any[] = [];
    for (const id of ids) {
      try {
        const data = await this.generatePrintData(id, type);
        results.push(data);
      } catch (e) {
        // Bỏ qua lỗi hoặc log lại nếu 1 đơn trong list bị lỗi
        console.error(`Lỗi in đơn ${id}:`, e.message);
      }
    }
    return results;
  }

  //HELPER METHODS
  private validateStateTransition(oldS: string, newS: string) {
    const flows = {
      PENDING: ['PRIORITY', 'CONFIRMED', 'CANCELLED'],
      PRIORITY: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['SHIPPING', 'CANCELLED'], // Đã xác nhận -> Vận chuyển hoặc Hủy
      SHIPPING: ['COMPLETED', 'CANCELLED'], // Có thể hoàn hàng
      COMPLETED: [], // End state
      CANCELLED: [], // End state
    };

    if (!flows[oldS] || !flows[oldS].includes(newS)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ ${oldS} sang ${newS} theo quy trình chuẩn.`,
      );
    }
  }

  private async restoreStock(order: Order, session: any) {
    for (const item of order.items) {
      await this.productModel
        .updateOne(
          { _id: item.product_id, 'variants.sku': item.sku },
          { $inc: { 'variants.$.stock': item.quantity } },
        )
        .session(session);
    }
  }

  // Helper
  private async logCreateOrder(userId, order, source, ip, userAgent) {
    await this.auditLogsService.log({
      action: 'CREATE_ORDER',
      collection_name: 'orders',
      actor_id: userId,
      target_id: order._id,
      department: Department.SALES,
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
