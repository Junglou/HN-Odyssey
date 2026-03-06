import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection, Types, FilterQuery, ClientSession } from 'mongoose';
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
import { StockService } from 'src/modules/inventory/stock/stock.service';
import {
  InitGuestCheckoutDto,
  VerifyGuestOtpDto,
} from './dto/guest-checkout.dto';
import { randomUUID } from 'crypto';
import {
  AggregateResult,
  CartItem,
  InvoiceOrder,
  MongooseOrderDoc,
  OrderData,
  OrderItem,
  PrintTemplateData,
  Voucher,
  VoucherType,
} from 'src/common/interfaces/oder.interface';
import { VnpayService } from '../payment/providers/vnpay.service';
import { ShippingConfig } from 'src/modules/shipping/schemas/shipping-config.schema';
import { ShippingService } from 'src/modules/shipping/shipping.service';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectConnection() private connection: Connection,
    @InjectRedis() private readonly redis: Redis,
    @InjectModel(ShippingConfig.name)
    private shippingConfigModel: Model<ShippingConfig>,
    private readonly auditLogsService: AuditLogsService,
    private readonly emailService: EmailService,
    private readonly pdfService: PdfService,
    private readonly promotionEngine: PromotionEngineService,
    private readonly stockService: StockService,
    private readonly vnpayService: VnpayService,
    private readonly paymentService: PaymentService,
    private readonly shippingService: ShippingService,
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
    const matchStage: Record<string, any> = { status: { $ne: 'TEMPORARY' } };

    if (status) matchStage['status'] = status;
    if (fromDate || toDate) {
      matchStage.createdAt = {};
      if (fromDate)
        (matchStage.createdAt as Record<string, any>).$gte = new Date(fromDate);
      if (toDate)
        (matchStage.createdAt as Record<string, any>).$lte = new Date(toDate);
    }

    // Nếu không search thì push matchStage bình thường
    // Nếu có search, matchStage sẽ lọc TRÊN KẾT QUẢ search -> Hiệu năng cực cao
    pipeline.push({ $match: matchStage });

    // 3. GIAI ĐOẠN SORT
    let sortStage: Record<string, number> = {};
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

    const [result] =
      await this.orderModel.aggregate<AggregateResult<Order>>(pipeline);

    const data = result?.data ?? [];
    const total = result?.totalCount?.[0]?.count ?? 0;

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
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Đơn hàng không tồn tại');
    }
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
    code?: string,
    userId?: string | null,
    items?: OrderItem[],
  ): Promise<{ finalTotal: number; discount: number }> {
    if (!code) return { finalTotal: originalTotal, discount: 0 };

    // 1. Query DB tìm Voucher
    const voucher = await this.connection
      .collection<Voucher>('promotions')
      .findOne({
        code: code.toUpperCase(),
        status: 'ACTIVE',
        start_date: { $lte: new Date() },
        end_date: { $gte: new Date() },
      });

    if (!voucher) {
      throw new BadRequestException('Mã giảm giá không hợp lệ hoặc đã hết hạn');
    }

    if (userId) {
      const usedCountByUser = await this.orderModel.countDocuments({
        user_id: new Types.ObjectId(userId),
        voucher_code: code.toUpperCase(),
        status: { $nin: ['CANCELLED', 'TEMPORARY'] },
      });

      const limitPerUser = 1;
      if (usedCountByUser >= limitPerUser) {
        throw new BadRequestException(
          'Bạn đã hết lượt sử dụng mã giảm giá này.',
        );
      }
    }

    // Định nghĩa type mở rộng cục bộ để tránh dùng 'any'
    // Báo cho TS biết Voucher này có thể có thêm trường applicable_category_ids
    type VoucherWithScope = Voucher & { applicable_category_ids?: string[] };
    const voucherWithScope = voucher as VoucherWithScope;

    // 2. LOGIC CHECK DANH MỤC (SCOPE)
    if (
      items &&
      voucherWithScope.applicable_category_ids &&
      voucherWithScope.applicable_category_ids.length > 0
    ) {
      const productIds = items.map((i) => i.product_id);

      // Tìm các sản phẩm trong giỏ hàng có thuộc danh mục được khuyến mãi không
      const validProducts = await this.productModel
        .find({
          _id: { $in: productIds },
          categories: { $in: voucherWithScope.applicable_category_ids },
        })
        .select('_id')
        .lean();

      const validProductIds = validProducts.map((p) => p._id.toString());

      // Tính tổng tiền của CÁC SẢN PHẨM HỢP LỆ thôi
      const eligibleAmount = items.reduce((sum, item) => {
        if (validProductIds.includes(item.product_id.toString())) {
          return sum + item.price * item.quantity;
        }
        return sum;
      }, 0);

      if (eligibleAmount < (voucher.min_order_value || 0)) {
        throw new BadRequestException(
          `Mã này chỉ áp dụng cho sản phẩm thuộc danh mục quy định (Tối thiểu ${voucher.min_order_value}đ).`,
        );
      }
    } else {
      // Logic check giá trị tối thiểu thông thường
      if (
        voucher.min_order_value !== undefined &&
        originalTotal < voucher.min_order_value
      ) {
        throw new BadRequestException(
          `Đơn hàng chưa đủ ${voucher.min_order_value}đ để dùng mã này`,
        );
      }
    }

    if (
      voucher.usage_limit !== undefined &&
      voucher.used_count >= voucher.usage_limit
    ) {
      throw new BadRequestException('Mã này đã hết lượt sử dụng');
    }

    // 3. Tính mức giảm
    let discount = 0;

    if (voucher.type === VoucherType.FIXED) {
      discount = voucher.value;
    } else if (voucher.type === VoucherType.PERCENT) {
      discount = originalTotal * (voucher.value / 100);
      if (voucher.max_discount_amount != null) {
        discount = Math.min(discount, voucher.max_discount_amount);
      }
    }

    // 4. Không cho giảm quá tiền đơn hàng
    discount = Math.min(discount, originalTotal);

    return {
      finalTotal: originalTotal - discount,
      discount,
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
      const queryCriteria: FilterQuery<Order> = {
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
        productId: product._id.toString(),
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
      await this.stockService.holdStock(
        {
          product_id: product._id.toString(),
          sku: variant.sku,
          quantity: data.quantity,
        },
        session, // Truyền session vào để đảm bảo Transaction
      );

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
      const token = `checkout_token_${tempOrder._id.toString()}_${randomUUID()}`;
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
      await session.endSession();
    }
  }

  async initGuestCheckout(dto: InitGuestCheckoutDto) {
    // 1. VALIDATION CƠ BẢN
    if (!dto.shippingInfo.email) {
      throw new BadRequestException(
        'Vui lòng nhập Email để nhận mã xác thực (OTP).',
      );
    }

    // [AC11] Rate Limit - Chống Spam OTP
    const otpKey = `guest_otp:${dto.shippingInfo.email}`;
    const ttl = await this.redis.ttl(otpKey);
    if (ttl > 240) {
      throw new BadRequestException(
        'Vui lòng đợi 60 giây trước khi gửi lại mã mới.',
      );
    }

    // Lấy giỏ hàng
    const cart = await this.cartModel.findOne({
      session_id: dto.cartSessionId,
    });

    if (!cart || !cart.items.length) {
      throw new BadRequestException('Giỏ hàng trống hoặc hết hạn');
    }

    const productIds = cart.items.map((i) => i.product_id);
    const products = await this.productModel
      .find({ _id: { $in: productIds } })
      .select('name variants thumbnail price weight')
      .lean();

    // 2. LOGIC GIỮ HÀNG & TẠO ĐƠN TẠM (TRANSACTION)
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // A. Dọn dẹp đơn tạm cũ (Nếu khách F5 hoặc bấm lại)
      const oldOrder = await this.orderModel
        .findOne({
          session_id: dto.cartSessionId,
          status: 'TEMPORARY',
          isGuest: true,
        })
        .session(session);

      if (oldOrder) {
        // Hoàn kho cho đơn cũ
        for (const item of oldOrder.items) {
          await this.stockService.restock(
            {
              product_id: item.product_id.toString(),
              sku: item.sku,
              quantity: item.quantity,
            },
            session, // [FIX 1] Truyền session vào đây để đồng bộ Transaction
          );
        }
        await this.orderModel.deleteOne({ _id: oldOrder._id }).session(session);
      }

      // B. [AC8] Giữ hàng mới (Soft Allocation)
      for (const item of cart.items) {
        await this.stockService.holdStock(
          {
            product_id: item.product_id.toString(),
            sku: item.sku,
            quantity: item.quantity,
          },
          session, // Đã có session -> An toàn
        );
      }

      // C. TẠO ĐƠN HÀNG TẠM
      const orderItems = cart.items.map((cartItem) => {
        const product = products.find(
          (p) => p._id.toString() === cartItem.product_id.toString(),
        );

        // Fallback nếu không tìm thấy (dù khó xảy ra)
        if (!product) {
          throw new BadRequestException('Sản phẩm trong giỏ không hợp lệ');
        }

        // Tìm variant để lấy giá chính xác
        const variant = product.variants.find((v) => v.sku === cartItem.sku);
        const realPrice = variant ? variant.sale_price || variant.price : 0;
        const realImage = variant?.image || product.thumbnail || '';

        return {
          product_id: cartItem.product_id,
          sku: cartItem.sku,
          quantity: cartItem.quantity,
          product_name: product.name || 'Sản phẩm không xác định',
          price: realPrice,
          image: realImage,
        };
      });

      const tempOrder = new this.orderModel({
        order_code: `GUEST-${Date.now()}`,
        session_id: dto.cartSessionId,
        isGuest: true,
        status: 'TEMPORARY',
        hold_expires_at: new Date(Date.now() + 15 * 60000),
        items: orderItems,
        guest_info: {
          name: dto.shippingInfo.name,
          phone: dto.shippingInfo.phone,
          email: dto.shippingInfo.email,
        },
        shipping_info: dto.shippingInfo,
        total_amount: orderItems.reduce(
          (sum, i) => sum + i.price * i.quantity,
          0,
        ),
      });
      await tempOrder.save({ session });

      // Commit transaction
      await session.commitTransaction();
    } catch (error: unknown) {
      // Rollback tự động
      // Chỉ cần abort, MongoDB sẽ tự hoàn tác việc trừ kho ở bước B và bước A
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

    // 3. XỬ LÝ OTP & PHẢN HỒI
    const existingUser = await this.connection
      .collection('users')
      .findOne({ email: dto.shippingInfo.email });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redis.set(otpKey, otpCode, 'EX', 300);

    // Lưu info tạm (Optional)
    await this.redis.set(
      `guest_temp_info:${dto.cartSessionId}`,
      JSON.stringify(dto.shippingInfo),
      'EX',
      900,
    );

    // Gửi Email (Không await để tránh block response)
    this.emailService
      .sendOtp(dto.shippingInfo.email, otpCode)
      .catch((e) => console.error('Lỗi gửi mail OTP:', e));

    return {
      message: `Mã xác thực đã được gửi đến ${dto.shippingInfo.email}. Hàng được giữ trong 15 phút.`,
      user_exists: !!existingUser,
      otp_sent_to: dto.shippingInfo.email,
    };
  }

  async verifyGuestOtp(dto: VerifyGuestOtpDto) {
    const otpKey = `guest_otp:${dto.email}`;
    const storedOtp = await this.redis.get(otpKey);

    if (!storedOtp || storedOtp !== dto.otpCode) {
      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn');
    }

    // Xác thực thành công -> Tạo token verified
    const verifiedKey = `guest_verified:${dto.cartSessionId}`;
    await this.redis.set(verifiedKey, 'TRUE', 'EX', 900);
    await this.redis.del(otpKey); // Xóa OTP cũ

    return {
      success: true,
      message: 'Xác thực thành công. Vui lòng tiến hành thanh toán.',
      verified_token: dto.cartSessionId,
    };
  }

  // 2. CREATE ORDER
  async createOrder(
    userId: string | null,
    dto: CreateOrderDto,
    ip: string,
    userAgent: string,
  ) {
    // A. LUỒNG MUA NGAY (BUY_NOW)
    if (dto.source === 'BUY_NOW') {
      if (!dto.checkoutSessionToken) {
        throw new BadRequestException('Thiếu Token phiên mua hàng');
      }

      const orderId = await this.redis.get(dto.checkoutSessionToken);
      if (!orderId) {
        throw new BadRequestException(
          'Phiên mua hàng đã hết hạn hoặc không tồn tại',
        );
      }

      const order = (await this.orderModel.findById(
        orderId,
      )) as unknown as MongooseOrderDoc;

      if (!order || order.status !== 'TEMPORARY') {
        throw new BadRequestException(
          'Đơn hàng không hợp lệ hoặc đã hết hạn giữ hàng',
        );
      }

      // 2. Tính phí vận chuyển
      const shippingFee = await this.shippingService.calculateShippingFee(
        dto.shippingInfo.city_code,
        dto.shippingInfo.district_code,
        order.items as unknown as (CartItem | OrderItem)[],
        dto.isInstant,
      );

      // 3. Kiểm tra trọng lượng
      const MAX_WEIGHT_KG = 50;
      let totalWeight = 0;
      for (const item of order.items) {
        const itemAny = item as unknown as { weight?: number };
        const w = itemAny.weight || 0.5;
        totalWeight += w * item.quantity;
      }

      if (totalWeight > MAX_WEIGHT_KG) {
        throw new BadRequestException(
          `Đơn hàng quá nặng (${totalWeight}kg). Vui lòng liên hệ hotline.`,
        );
      }

      // 4. Logic Voucher
      const { finalTotal: totalAfterVoucher, discount } =
        await this.applyVoucher(
          order.total_amount,
          dto.voucherCode,
          userId,
          order.items as unknown as OrderItem[], // Truyền items để check category
        );

      // 5. Tổng thanh toán
      const finalOrderTotal = totalAfterVoucher + shippingFee;

      // 6. Check COD Limit
      if (dto.paymentMethod === 'COD' && finalOrderTotal > 5000000) {
        throw new BadRequestException('Đơn hàng > 5 triệu không hỗ trợ COD.');
      }

      // 7. Cập nhật & Save
      order.shipping_info = {
        ...dto.shippingInfo,
        email: dto.shippingInfo.email || '',
        name: dto.shippingInfo.name || '',
        phone: dto.shippingInfo.phone || '',
        address: dto.shippingInfo.address || '',
        city_code: Number(dto.shippingInfo.city_code),
        district_code: Number(dto.shippingInfo.district_code),
        ward_code: dto.shippingInfo.ward_code || '',
      };

      if (!order.guest_info) {
        order.guest_info = {
          name: dto.shippingInfo.name || '',
          phone: dto.shippingInfo.phone || '',
          email: dto.shippingInfo.email || '',
        };
      } else {
        order.guest_info.email = dto.shippingInfo.email || '';
      }

      order.payment = {
        method: dto.paymentMethod,
        status: 'PENDING',
      };

      order.status = 'PENDING';
      order.total_amount = finalOrderTotal;
      order.shipping_fee = shippingFee;
      order.discount_amount = discount;
      order.voucher_code = dto.voucherCode || '';

      if (dto.voucherCode) {
        await this.connection
          .collection('promotions')
          .updateOne({ code: dto.voucherCode }, { $inc: { used_count: 1 } });
      }

      if (!order.timeline) {
        order.timeline = [];
      }

      order.timeline.push({
        status: 'PENDING',
        timestamp: new Date(),
        actor: userId ? 'Member' : 'Guest',
        note: `BuyNow Order Created. Ship: ${shippingFee}`,
      });

      await order.save();
      await this.redis.del(dto.checkoutSessionToken);

      // Tự động lấy cấu hình tạo Link theo phương thức
      let paymentUrl: string | null = null;
      if (order.payment.method !== 'COD') {
        paymentUrl = await this.paymentService.createPaymentUrl(
          order.payment.method,
          {
            orderCode: order.order_code,
            amount: order.total_amount,
            description: `Thanh toan don hang ${order.order_code}`,
            ipAddr: ip,
          },
        );
      }

      const emailToSend = order.guest_info?.email || order.shipping_info?.email;
      if (emailToSend) {
        this.emailService
          .sendInvoice(emailToSend, order as unknown as InvoiceOrder)
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to send invoice email: ${msg}`);
          });
      }
      await this.logCreateOrder(userId, order, dto.source, ip, userAgent);

      return {
        order: order,
        paymentUrl: paymentUrl,
        message: 'Tạo đơn hàng thành công',
      };
    }

    // B. LUỒNG MUA TỪ GIỎ HÀNG (CART)
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const cartQuery: { user_id?: Types.ObjectId; session_id?: string } = {};
      let isGuestFlow = false;
      let orderToUpdate: MongooseOrderDoc | null = null;

      if (userId) {
        const userCartExists = await this.cartModel.exists({
          user_id: new Types.ObjectId(userId),
        });

        if (userCartExists) {
          cartQuery.user_id = new Types.ObjectId(userId);
        } else if (dto.guestSessionId) {
          cartQuery.session_id = dto.guestSessionId;
        } else {
          cartQuery.user_id = new Types.ObjectId(userId);
        }
      } else if (dto.guestSessionId) {
        const isVerified = await this.redis.get(
          `guest_verified:${dto.guestSessionId}`,
        );
        if (!isVerified) {
          throw new BadRequestException(
            'Phiên giao dịch chưa được xác thực hoặc đã hết hạn.',
          );
        }

        const tempOrder = await this.orderModel
          .findOne({
            session_id: dto.guestSessionId,
            status: 'TEMPORARY',
            isGuest: true,
          })
          .session(session);

        if (!tempOrder) {
          throw new BadRequestException(
            'Không tìm thấy phiên đặt hàng (Hết hạn giữ hàng). Vui lòng thử lại.',
          );
        }

        orderToUpdate = tempOrder as unknown as MongooseOrderDoc;
        cartQuery.session_id = dto.guestSessionId;
        isGuestFlow = true;
      } else {
        throw new BadRequestException('Không xác định được danh tính.');
      }

      const cart = await this.cartModel.findOne(cartQuery).session(session);
      if (!cart || !cart.items.length) {
        throw new BadRequestException('Giỏ hàng trống.');
      }

      const orderItems: OrderItem[] = [];
      let itemsTotalAmount = 0;
      let totalWeight = 0;

      for (const item of cart.items) {
        const product = await this.productModel
          .findById(item.product_id)
          .session(session);

        if (!product || product.status !== ProductStatus.ACTIVE) {
          throw new BadRequestException(`Sản phẩm ${item.sku} không khả dụng`);
        }

        const variant = product.variants.find((v) => v.sku === item.sku);
        if (!variant) throw new BadRequestException(`Lỗi biến thể ${item.sku}`);

        if (product.is_member_only && !userId) {
          throw new BadRequestException(
            `Sản phẩm ${product.name} chỉ dành cho Member.`,
          );
        }
        if (
          product.max_purchase_qty &&
          item.quantity > product.max_purchase_qty
        ) {
          throw new BadRequestException(
            `Quá giới hạn mua ${product.max_purchase_qty}.`,
          );
        }

        const productWithWeight = product as unknown as {
          weight?: number;
        };
        const weight = productWithWeight.weight || 0.5;
        totalWeight += weight * item.quantity;

        if (isGuestFlow) {
          await this.productModel
            .updateOne(
              { _id: product._id, 'variants.sku': item.sku },
              { $inc: { 'variants.$.stock_on_hold': -item.quantity } },
            )
            .session(session);
        } else {
          if (variant.stock < item.quantity) {
            throw new BadRequestException(`Sản phẩm ${product.name} hết hàng.`);
          }
          await this.productModel
            .updateOne(
              { _id: product._id, 'variants.sku': item.sku },
              { $inc: { 'variants.$.stock': -item.quantity } },
            )
            .session(session);
        }

        const currentPrice =
          variant.sale_price > 0 ? variant.sale_price : variant.price;
        const mainImage = product.images?.[0] || '';

        orderItems.push({
          product_id: product._id,
          sku: variant.sku,
          product_name: product.name,
          price: currentPrice,
          quantity: item.quantity,
          image: mainImage,
        });
      }

      if (totalWeight > 50) {
        throw new BadRequestException(`Đơn hàng quá nặng (${totalWeight}kg).`);
      }

      const itemsForPromo = orderItems.map((i) => ({
        productId: i.product_id.toString(),
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: i.price,
      }));

      const { items: discountedItems, totalDiscount: promoDiscount } =
        await this.promotionEngine.applyCombos(itemsForPromo);

      for (const item of orderItems) {
        const promoItem = discountedItems.find(
          (d) =>
            d.productId.toString() === item.product_id.toString() &&
            d.sku === item.sku,
        );

        if (promoItem) {
          item.price = promoItem.discountedPrice || promoItem.unitPrice;
        }
        itemsTotalAmount += item.price * item.quantity;
      }

      const shippingFee = await this.shippingService.calculateShippingFee(
        dto.shippingInfo?.city_code,
        dto.shippingInfo?.district_code,
        orderItems,
        dto.isInstant,
      );

      const { finalTotal: totalAfterVoucher, discount: voucherDiscount } =
        await this.applyVoucher(
          itemsTotalAmount,
          dto.voucherCode,
          userId,
          orderItems,
        );

      const finalOrderTotal = totalAfterVoucher + shippingFee;

      if (dto.paymentMethod === 'COD' && finalOrderTotal > 5000000) {
        throw new BadRequestException('Đơn hàng > 5 triệu không hỗ trợ COD.');
      }

      // Khởi tạo biến để tránh lỗi used before assigned
      let savedOrder: MongooseOrderDoc;

      // Block xử lý tạo đơn hàng (Bao gồm cả Guest và Member)
      if (isGuestFlow && orderToUpdate) {
        // CASE 1: GUEST (Đã verify OTP)
        const orderDoc = orderToUpdate;

        const confirmedItems = orderDoc.items as unknown as OrderItem[];

        let reCalcTotal = 0;
        // Xóa reCalcWeight không dùng đến

        for (const item of confirmedItems) {
          reCalcTotal += item.price * item.quantity;
        }

        const shippingFeeGuest =
          await this.shippingService.calculateShippingFee(
            dto.shippingInfo?.city_code,
            dto.shippingInfo?.district_code,
            confirmedItems,
            dto.isInstant,
          );

        const {
          finalTotal: totalAfterVoucherGuest,
          discount: voucherDiscountGuest,
        } = await this.applyVoucher(
          reCalcTotal,
          dto.voucherCode,
          userId,
          confirmedItems,
        );

        const finalOrderTotalGuest = totalAfterVoucherGuest + shippingFeeGuest;

        // Cập nhật Order Doc
        orderDoc.order_code = `ORD-${Date.now()}`;
        orderDoc.shipping_info = {
          ...dto.shippingInfo,
          email: dto.shippingInfo.email || '',
          name: dto.shippingInfo.name || '',
          phone: dto.shippingInfo.phone || '',
          address: dto.shippingInfo.address || '',
          city_code: Number(dto.shippingInfo.city_code),
          district_code: Number(dto.shippingInfo.district_code),
          ward_code: dto.shippingInfo.ward_code || '',
        };
        orderDoc.guest_info = {
          name: dto.shippingInfo.name || '',
          phone: dto.shippingInfo.phone || '',
          email: dto.shippingInfo.email || '',
        };
        orderDoc.payment = {
          method: dto.paymentMethod,
          status: 'PENDING',
        };
        orderDoc.total_amount = finalOrderTotalGuest;
        orderDoc.discount_amount =
          (orderDoc.discount_amount || 0) + (voucherDiscountGuest || 0);
        orderDoc.shipping_fee = shippingFeeGuest;
        orderDoc.voucher_code = dto.voucherCode || '';
        orderDoc.status = 'PENDING';
        orderDoc.hold_expires_at = new Date(Date.now() + 15 * 60000);

        if (!orderDoc.timeline) orderDoc.timeline = [];
        orderDoc.timeline.push({
          status: 'PENDING',
          timestamp: new Date(),
          actor: 'Guest',
          note: 'Guest confirmed order via Cart (OTP Verified)',
        });

        // Xả kho giữ (Hold) -> Kho bán (Sold)
        for (const item of confirmedItems) {
          await this.productModel
            .updateOne(
              { _id: item.product_id, 'variants.sku': item.sku },
              { $inc: { 'variants.$.stock_on_hold': -item.quantity } },
            )
            .session(session);
        }

        await orderDoc.save({ session });
        savedOrder = orderDoc;

        // Xóa Guest Cart
        await this.cartModel
          .deleteOne({ session_id: dto.guestSessionId })
          .session(session);
      } else {
        // CASE 2: MEMBER (Hoặc Guest thường không qua Flow OTP)
        const newOrder = new this.orderModel({
          order_code: `ORD-${Date.now()}`,
          user_id: userId ? new Types.ObjectId(userId) : null,
          items: orderItems,
          shipping_info: {
            ...dto.shippingInfo,
            email: dto.shippingInfo.email || '',
            name: dto.shippingInfo.name || '',
            phone: dto.shippingInfo.phone || '',
            address: dto.shippingInfo.address || '',
          },
          payment: {
            method: dto.paymentMethod,
            status: 'PENDING',
          },
          total_amount: finalOrderTotal,
          discount_amount: promoDiscount + (voucherDiscount || 0),
          shipping_fee: shippingFee,
          voucher_code: dto.voucherCode || '',
          status: 'PENDING',
          isGuest: false,
          hold_expires_at: new Date(Date.now() + 15 * 60000),
          timeline: [
            {
              status: 'PENDING',
              timestamp: new Date(),
              actor: 'Member',
              note: 'Member created order',
            },
          ],
        }) as unknown as MongooseOrderDoc;

        await newOrder.save({ session });
        savedOrder = newOrder;
      }

      // Xử lý Voucher Usage Count
      if (dto.voucherCode) {
        const voucher = await this.connection
          .collection<Voucher>('promotions')
          .findOne({ code: dto.voucherCode }, { session });

        if (voucher) {
          if (voucher.usage_limit && voucher.usage_limit > 0) {
            const updateResult = await this.connection
              .collection('promotions')
              .updateOne(
                {
                  code: dto.voucherCode,
                  used_count: { $lt: voucher.usage_limit },
                },
                { $inc: { used_count: 1 } },
                { session },
              );

            if (updateResult.modifiedCount === 0) {
              throw new BadRequestException(
                'Mã giảm giá đã hết lượt sử dụng ngay trong lúc bạn thanh toán.',
              );
            }
          } else {
            await this.connection
              .collection('promotions')
              .updateOne(
                { code: dto.voucherCode },
                { $inc: { used_count: 1 } },
                { session },
              );
          }
        }
      }

      await this.cartModel.deleteOne({ _id: cart._id }).session(session);
      await session.commitTransaction();

      if (isGuestFlow && dto.guestSessionId) {
        await this.redis.del(`guest_verified:${dto.guestSessionId}`);
        await this.redis.del(`guest_temp_info:${dto.guestSessionId}`);
      }

      // Tự động lấy cấu hình tạo Link theo phương thức
      let paymentUrl: string | null = null;
      if (savedOrder.payment.method !== 'COD') {
        paymentUrl = await this.paymentService.createPaymentUrl(
          savedOrder.payment.method,
          {
            orderCode: savedOrder.order_code,
            amount: savedOrder.total_amount,
            description: `Thanh toan don hang ${savedOrder.order_code}`,
            ipAddr: ip,
          },
        );
      }

      const recipientEmail = dto.shippingInfo.email;
      if (recipientEmail) {
        this.emailService
          .sendInvoice(recipientEmail, savedOrder as unknown as InvoiceOrder)
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to send invoice email: ${msg}`);
          });
      }

      await this.logCreateOrder(userId, savedOrder, dto.source, ip, userAgent);

      return {
        order: savedOrder,
        paymentUrl: paymentUrl,
        message: 'Tạo đơn hàng thành công',
      };
    } catch (error: unknown) {
      await session.abortTransaction();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await this.auditLogsService.log({
        action: 'CREATE_ORDER_FAILED',
        collection_name: 'orders',
        actor_id: userId,
        department: Department.SALES,
        detail: { error: errorMessage },
        is_success: false,
        ip: ip,
        user_agent: userAgent,
      });
      throw error;
    } finally {
      await session.endSession();
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

    type OrderUpdatePayload = {
      status: string;
      'payment.status'?: string; // Cho phép key đặc biệt này
    };

    const updateData: OrderUpdatePayload = { status };

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
        await this.restoreStock(order as unknown as MongooseOrderDoc, session);
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
      await session.endSession();
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
    const orderDoc = order as unknown as MongooseOrderDoc;

    // Trả về data cấu trúc để Frontend render PDF hoặc dùng thư viện tạo PDF tại đây
    return {
      type,
      print_date: new Date(),
      is_copy: order.print_count > 1, // Nếu in > 1 lần là bản sao
      order_info: {
        code: order.order_code,
        created_at: new Date(orderDoc.createdAt || Date.now()),
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
    const order = (await this.orderModel
      .findById(id)
      .populate('user_id')) as unknown as MongooseOrderDoc;

    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const populatedUser = order.user_id as unknown as { email: string };

    const recipientEmail =
      order.shipping_info?.email ||
      order.guest_info?.email ||
      populatedUser?.email;

    if (!recipientEmail) {
      throw new BadRequestException(
        'Đơn hàng này không có địa chỉ email liên kết',
      );
    }

    try {
      // 1. Tạo file PDF từ PdfService
      const orderPlain = order.toObject ? order.toObject() : order;
      const pdfBuffer = await this.pdfService.generateInvoice(
        orderPlain as unknown as OrderData,
      );

      // 2. Gửi mail kèm Buffer
      await this.emailService.sendInvoice(
        recipientEmail,
        order.toObject() as unknown as InvoiceOrder,
        pdfBuffer,
      );

      // 3. Log lại
      await this.auditLogsService.log({
        action: 'SEND_INVOICE_EMAIL',
        collection_name: 'orders',
        target_id: order._id as string,
        department: Department.SALES,
        detail: { email: recipientEmail, has_attachment: true },
        is_success: true,
      });

      return {
        success: true,
        message: `Đã gửi hóa đơn (kèm PDF) đến ${recipientEmail}`,
      };
    } catch (error: unknown) {
      // Xử lý biến error an toàn (không gọi .message trực tiếp trên unknown)
      console.error('Lỗi gửi mail/tạo PDF:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      throw new BadRequestException('Gửi email thất bại: ' + errorMessage);
    }
  }

  // 3. Thêm hàm lấy dữ liệu in hàng loạt (AC4)
  async generateBulkPrintData(
    ids: string[],
    type: 'INVOICE' | 'PACKING_SLIP',
  ): Promise<PrintTemplateData[]> {
    const results: PrintTemplateData[] = [];

    for (const id of ids) {
      try {
        const data = (await this.generatePrintData(
          id,
          type,
        )) as unknown as PrintTemplateData;
        results.push(data);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        console.error(`Lỗi in đơn ${id}:`, errorMessage);
      }
    }
    return results;
  }

  //HELPER METHODS
  private validateStateTransition(oldS: string, newS: string) {
    const flows: Record<string, string[]> = {
      PENDING: ['PRIORITY', 'CONFIRMED', 'CANCELLED'],
      PRIORITY: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['SHIPPING', 'CANCELLED'],
      SHIPPING: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    const allowedNextStates = flows[oldS];

    if (!allowedNextStates || !allowedNextStates.includes(newS)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ ${oldS} sang ${newS} theo quy trình chuẩn.`,
      );
    }
  }

  private async restoreStock(order: MongooseOrderDoc, session: ClientSession) {
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
  private async logCreateOrder(
    userId: string | null | undefined,
    order: MongooseOrderDoc,
    source: string,
    ip: string,
    userAgent: string,
  ) {
    await this.auditLogsService.log({
      action: 'CREATE_ORDER',
      collection_name: 'orders',
      actor_id: userId || undefined,
      target_id: String(order._id),
      department: Department.SALES,
      detail: {
        order_code: order.order_code,
        total: order.total_amount,
        item_count: order.items.length,
        source: source,
        payment_method: order.payment?.method || 'UNKNOWN',
      },
      is_success: true,
      ip: ip,
      user_agent: userAgent,
    });
  }

  // Hàm tính toán xem trước (Không lưu DB)
  async previewOrder(dto: CreateOrderDto) {
    let items: (CartItem | OrderItem)[] = [];
    if (dto.source === 'CART' && dto.guestSessionId) {
      const cartQuery: FilterQuery<Cart> = {};
      if (dto.guestSessionId) cartQuery.session_id = dto.guestSessionId;
      const cart = await this.cartModel.findOne(cartQuery);
      if (!cart) throw new BadRequestException('Giỏ hàng không tồn tại');
      items = cart.items as unknown as CartItem[];
    } else if (dto.source === 'BUY_NOW' && dto.checkoutSessionToken) {
      // LUỒNG BUY_NOW
      const orderId = await this.redis.get(dto.checkoutSessionToken);
      if (!orderId) {
        throw new BadRequestException('Phiên mua hàng hết hạn');
      }

      const tempOrder = await this.orderModel.findById(orderId);
      if (!tempOrder || tempOrder.status !== 'TEMPORARY') {
        throw new BadRequestException('Đơn hàng tạm không hợp lệ');
      }

      // Ép kiểu sang OrderItem[]
      items = tempOrder.items as unknown as OrderItem[];
    }

    if (!items.length) {
      // Trả về mặc định nếu không có item nào (tránh crash reduce)
      return {
        subtotal: 0,
        shipping_fee: 0,
        discount_amount: 0,
        total_amount: 0,
        can_cod: true,
      };
    }

    // 2. Tính toán (Type-Safe)
    const itemsTotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // 3. Tính phí Ship
    const shippingFee = await this.shippingService.calculateShippingFee(
      dto.shippingInfo?.city_code,
      dto.shippingInfo?.district_code,
      items,
      dto.isInstant,
    );

    // 4. Tính Voucher
    const { discount, finalTotal: totalAfterVoucher } = await this.applyVoucher(
      itemsTotal,
      dto.voucherCode,
      null,
    );

    // 5. Kết quả cuối
    const totalAmount = totalAfterVoucher + shippingFee;

    return {
      subtotal: itemsTotal,
      shipping_fee: shippingFee,
      discount_amount: discount,
      voucher_code: dto.voucherCode || null,
      total_amount: totalAmount,
      shipping_method: dto.isInstant ? 'Hỏa tốc' : 'Tiêu chuẩn',
      can_cod: totalAmount <= 5000000,
    };
  }
}
