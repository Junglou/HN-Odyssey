import {
  BadRequestException,
  Injectable,
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
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import {
  AggregateResult,
  CartItem,
  InvoiceOrder,
  MongooseOrderDoc,
  OrderData,
  OrderItem,
  PrintTemplateData,
  VnpayReturnParams,
  Voucher,
  VoucherType,
} from 'src/common/interfaces/oder.interface';
import * as crypto from 'crypto';

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
    private readonly stockService: StockService,
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
  // orders.service.ts

  private async applyVoucher(
    originalTotal: number,
    code?: string,
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

    // 2. Check điều kiện
    if (
      voucher.min_order_value !== undefined &&
      originalTotal < voucher.min_order_value
    ) {
      throw new BadRequestException(
        `Đơn hàng chưa đủ ${voucher.min_order_value}đ để dùng mã này`,
      );
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

    // Kiểm tra Email bắt buộc theo AC2 ngay đầu hàm
    if (!dto.shippingInfo.email) {
      throw new BadRequestException(
        'Vui lòng nhập Email để nhận mã xác thực (OTP).',
      );
    }

    // [AC11] Rate Limit - Chống Spam OTP (60s cooldown)
    const otpKey = `guest_otp:${dto.shippingInfo.email}`;
    const ttl = await this.redis.ttl(otpKey);
    // Nếu key còn tồn tại và thời gian sống > (5 phút - 60 giây) -> Tức là vừa gửi chưa được 60s
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

    // ---------------------------------------------------------
    // 2. LOGIC GIỮ HÀNG & TẠO ĐƠN TẠM (CRITICAL FIX)
    // ---------------------------------------------------------
    const session = await this.connection.startSession();
    session.startTransaction();

    // [FIX 1] Định nghĩa kiểu rõ ràng cho heldItems thay vì any[]
    // Giúp tránh lỗi 'Unsafe assignment' khi truy cập thuộc tính bên trong loop rollback
    const heldItems: { product_id: any; sku: string; quantity: number }[] = [];

    try {
      // A. Dọn dẹp đơn tạm cũ (Nếu khách F5 hoặc bấm lại)
      // Tránh việc 1 session giữ kho 2-3 lần
      const oldOrder = await this.orderModel
        .findOne({
          session_id: dto.cartSessionId,
          status: 'TEMPORARY',
          isGuest: true,
        })
        .session(session);

      if (oldOrder) {
        // Hoàn kho cho đơn cũ trước khi tạo đơn mới
        for (const item of oldOrder.items) {
          await this.stockService.restock({
            product_id: item.product_id.toString(),
            sku: item.sku,
            quantity: item.quantity,
          });
        }
        await this.orderModel.deleteOne({ _id: oldOrder._id }).session(session);
      }

      // B. [AC8] Giữ hàng mới (Soft Allocation)
      for (const item of cart.items) {
        await this.stockService.holdStock({
          product_id: item.product_id.toString(),
          sku: item.sku,
          quantity: item.quantity,
        });
        heldItems.push({
          product_id: item.product_id.toString(), // Convert ngay lúc này
          sku: item.sku,
          quantity: item.quantity,
        });
      }

      // C. TẠO ĐƠN HÀNG TẠM (TEMPORARY)
      // Đây là bước quan trọng nhất để CronJob có thể quét và hoàn kho sau 15p
      const tempOrder = new this.orderModel({
        order_code: `GUEST-${Date.now()}`,
        session_id: dto.cartSessionId,
        isGuest: true,
        status: 'TEMPORARY', // Trạng thái này sẽ được CronJob theo dõi
        hold_expires_at: new Date(Date.now() + 15 * 60000), // [AC8] 15 phút
        items: cart.items.map((i) => ({
          ...i,
          product_name: 'Checking out...', // Tạm thời
          price: 0, // Tạm thời, sẽ tính lại ở bước createOrder
        })),
        guest_info: {
          name: dto.shippingInfo.name,
          phone: dto.shippingInfo.phone,
          email: dto.shippingInfo.email,
        },
        shipping_info: dto.shippingInfo,
        total_amount: 0, // Tạm thời
      });

      await tempOrder.save({ session });

      // Commit transaction nếu mọi thứ ổn
      await session.commitTransaction();
    } catch (error: unknown) {
      await session.abortTransaction();

      const heldItems: {
        product_id: string;
        sku: string;
        quantity: number;
      }[] = [];

      // Rollback thủ công: Nếu đã lỡ giữ hàng (holdItems) mà lỗi ở bước save order -> Phải nhả hàng ra
      if (heldItems.length > 0) {
        // 1. Lấy message lỗi an toàn
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        console.error('Lỗi transaction, đang hoàn kho...', errorMessage);

        // 2. Duyệt qua mảng hàng đã giữ
        for (const heldItem of heldItems) {
          await this.stockService.restock({
            product_id: heldItem.product_id,
            sku: heldItem.sku,
            quantity: heldItem.quantity,
          });
        }
      }
      throw error; // Ném lỗi ra cho Controller xử lý
    } finally {
      await session.endSession();
    }

    // ---------------------------------------------------------
    // 3. XỬ LÝ OTP & PHẢN HỒI
    // ---------------------------------------------------------

    // [AC6] Kiểm tra User tồn tại để gợi ý Login (Helper cho UI)
    const existingUser = await this.connection
      .collection('users')
      .findOne({ email: dto.shippingInfo.email });

    // [AC4] Sinh OTP & Lưu Redis
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redis.set(otpKey, otpCode, 'EX', 300); // 5 phút

    // Vẫn lưu info tạm vào Redis để tiện cho bước Verify (tuỳ chọn, nhưng giữ lại cho logic cũ hoạt động)
    await this.redis.set(
      `guest_temp_info:${dto.cartSessionId}`,
      JSON.stringify(dto.shippingInfo),
      'EX',
      900,
    );

    // [INTEGRATION] Gửi Email OTP
    try {
      await this.emailService.sendOtp(dto.shippingInfo.email, otpCode);
    } catch (error) {
      console.error('Lỗi gửi mail OTP:', error);
      // Không throw lỗi để tránh block flow, khách có thể bấm "Gửi lại" sau
    }

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
  ): Promise<MongooseOrderDoc> {
    // ---------------------------------------------------------
    // A. LUỒNG MUA NGAY (BUY_NOW)
    // ---------------------------------------------------------
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

      // [FIX 1]: Sử dụng MongooseOrderDoc để có đầy đủ typing cho hàm .save() và các field
      const order = (await this.orderModel.findById(
        orderId,
      )) as unknown as MongooseOrderDoc;

      if (!order || order.status !== 'TEMPORARY') {
        throw new BadRequestException(
          'Đơn hàng không hợp lệ hoặc đã hết hạn giữ hàng',
        );
      }

      // 2. Tính phí vận chuyển
      let shippingFee = 30000;
      if (['HCM', '79'].includes(dto.shippingInfo.city_code || '')) {
        shippingFee = 15000;
      }

      // 3. Kiểm tra trọng lượng
      const MAX_WEIGHT_KG = 50;
      let totalWeight = 0;
      // [FIX 2]: Ép kiểu item an toàn
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
        await this.applyVoucher(order.total_amount, dto.voucherCode);

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

      // [FIX 3]: Truy cập timeline trực tiếp vì MongooseOrderDoc đã định nghĩa nó
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

      // Gửi mail & Log
      const emailToSend = order.guest_info?.email || order.shipping_info?.email;
      if (emailToSend) {
        this.emailService
          // [FIX 4]: Ép kiểu sang InvoiceOrder
          .sendInvoice(emailToSend, order as unknown as InvoiceOrder)
          .catch(console.error);
      }
      await this.logCreateOrder(userId, order, dto.source, ip, userAgent);

      return order;
    }

    // ---------------------------------------------------------
    // B. LUỒNG MUA TỪ GIỎ HÀNG (CART)
    // ---------------------------------------------------------
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 1. Chuẩn bị dữ liệu
      const cartQuery: { user_id?: Types.ObjectId; session_id?: string } = {};
      let isGuestFlow = false;

      // [FIX 5]: Định nghĩa kiểu cho orderToUpdate là MongooseOrderDoc hoặc null
      let orderToUpdate: MongooseOrderDoc | null = null;

      if (userId) {
        // MEMBER
        cartQuery.user_id = new Types.ObjectId(userId);
      } else if (dto.guestSessionId) {
        // GUEST
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

        // [FIX 6]: Ép kiểu kết quả tìm được về MongooseOrderDoc
        orderToUpdate = tempOrder as unknown as MongooseOrderDoc;
        cartQuery.session_id = dto.guestSessionId;
        isGuestFlow = true;
      } else {
        throw new BadRequestException('Không xác định được danh tính.');
      }

      // 2. Lấy Cart
      const cart = await this.cartModel.findOne(cartQuery).session(session);
      if (!cart || !cart.items.length) {
        throw new BadRequestException('Giỏ hàng trống.');
      }

      // 3. TÍNH TOÁN CORE
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

        const productWithWeight = product as unknown as { weight?: number };
        const weight = productWithWeight.weight || 0.5;
        totalWeight += weight * item.quantity;

        // Inventory Logic
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

      // 4. Promotion Engine
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

      // 5. Shipping & Voucher
      let shippingFee = 30000;
      if (['HCM', '79'].includes(dto.shippingInfo.city_code || '')) {
        shippingFee = 15000;
      }

      const { finalTotal: totalAfterVoucher, discount: voucherDiscount } =
        await this.applyVoucher(itemsTotalAmount, dto.voucherCode);

      const finalOrderTotal = totalAfterVoucher + shippingFee;

      if (dto.paymentMethod === 'COD' && finalOrderTotal > 5000000) {
        throw new BadRequestException('Đơn hàng > 5 triệu không hỗ trợ COD.');
      }

      // 6. SAVE ORDER
      // [FIX 7]: Khai báo tường minh kiểu trả về
      let savedOrder: MongooseOrderDoc;

      if (isGuestFlow && orderToUpdate) {
        // [GUEST]: Update OrderDoc
        // Vì orderToUpdate đã được ép kiểu MongooseOrderDoc ở trên, ta dùng trực tiếp
        const orderDoc = orderToUpdate;

        orderDoc.order_code = `ORD-${Date.now()}`;
        orderDoc.items = orderItems;

        orderDoc.shipping_info = {
          ...dto.shippingInfo,
          email: dto.shippingInfo.email || '',
          name: dto.shippingInfo.name || '',
          phone: dto.shippingInfo.phone || '',
          address: dto.shippingInfo.address || '',
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

        orderDoc.total_amount = finalOrderTotal;
        orderDoc.discount_amount = promoDiscount + (voucherDiscount || 0);
        orderDoc.shipping_fee = shippingFee;
        orderDoc.voucher_code = dto.voucherCode || '';
        orderDoc.status = 'PENDING';
        orderDoc.hold_expires_at = new Date(Date.now() + 15 * 60000);

        // [FIX 8]: Logic timeline sạch sẽ nhờ Interface
        if (!orderDoc.timeline) {
          orderDoc.timeline = [];
        }
        orderDoc.timeline.push({
          status: 'PENDING',
          timestamp: new Date(),
          actor: 'Guest',
          note: 'Guest confirmed order via Cart',
        });

        await orderDoc.save({ session });
        savedOrder = orderDoc;
      } else {
        // [MEMBER]: Create New Order
        // [FIX 9]: Ép kiểu ngay khi khởi tạo new Model
        const newOrder = new this.orderModel({
          order_code: `ORD-${Date.now()}`,
          user_id: new Types.ObjectId(userId as string),
          items: orderItems,
          shipping_info: {
            ...dto.shippingInfo,
            email: dto.shippingInfo.email || '',
            name: dto.shippingInfo.name || '',
            phone: dto.shippingInfo.phone || '',
            address: dto.shippingInfo.address || '',
          },
          payment: { method: dto.paymentMethod, status: 'PENDING' },
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

      // 7. Cleanup & Return
      await this.cartModel.deleteOne({ _id: cart._id }).session(session);
      await session.commitTransaction();

      if (isGuestFlow && dto.guestSessionId) {
        await this.redis.del(`guest_verified:${dto.guestSessionId}`);
        await this.redis.del(`guest_temp_info:${dto.guestSessionId}`);
      }

      const recipientEmail = dto.shippingInfo.email;
      if (recipientEmail) {
        this.emailService
          // [FIX 10]: Ép kiểu cho hàm sendInvoice
          .sendInvoice(recipientEmail, savedOrder as unknown as InvoiceOrder)
          .catch(console.error);
      }

      await this.logCreateOrder(userId, savedOrder, dto.source, ip, userAgent);

      // [FIX 11]: Return an toàn vì savedOrder đã có kiểu MongooseOrderDoc
      return savedOrder;
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
    } catch (error) {
      // [FIX 4]: Xử lý biến error an toàn (không gọi .message trực tiếp trên unknown)
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
    userId: string | null, // userId có thể null (Guest)
    order: MongooseOrderDoc, // [FIX]: Dùng Interface chuẩn thay vì 'any'
    source: string,
    ip: string,
    userAgent: string,
  ) {
    await this.auditLogsService.log({
      action: 'CREATE_ORDER',
      collection_name: 'orders',
      actor_id: userId, // Nếu userId null, AuditLogService cần xử lý được case này (hoặc ép về string rỗng nếu cần)
      target_id: order._id as string, // [FIX]: Ép kiểu về string
      department: Department.SALES,
      detail: {
        order_code: order.order_code,
        total: order.total_amount,
        item_count: order.items.length,
        source: source,
        payment_method: order.payment?.method, // [FIX]: Đã có thể log an toàn nhờ Interface
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
    const shippingFee = this.calculateShippingFee(
      dto.shippingInfo?.city_code,
      items,
    );

    // 4. Tính Voucher
    const { discount, finalTotal: totalAfterVoucher } = await this.applyVoucher(
      itemsTotal,
      dto.voucherCode,
    );

    // 5. Kết quả cuối
    const totalAmount = totalAfterVoucher + shippingFee;

    return {
      subtotal: itemsTotal,
      shipping_fee: shippingFee,
      discount_amount: discount,
      voucher_code: dto.voucherCode || null,
      total_amount: totalAmount,
      shipping_method: 'Tiêu chuẩn',
      can_cod: totalAmount <= 5000000,
    };
  }

  // Hàm tính phí ship tách riêng
  private calculateShippingFee(
    cityCode: string | undefined | null,
    items: (CartItem | OrderItem)[],
  ): number {
    if (!cityCode) return 0;

    // Logic: Tính tổng trọng lượng
    const totalWeight = items.reduce((w, i) => {
      const itemWithWeight = i as unknown as {
        weight?: number;
        quantity: number;
      };

      const itemWeight = itemWithWeight.weight || 0.5; // Mặc định 0.5kg nếu thiếu
      return w + itemWeight * i.quantity;
    }, 0);

    // AC14: Check trọng lượng quá khổ
    if (totalWeight > 50) {
      throw new BadRequestException(
        'Đơn hàng quá nặng (>50kg). Vui lòng liên hệ hotline.',
      );
    }

    // AC: Phí cơ bản
    let fee = 30000;
    // Check code tỉnh thành (HCM, HN...)
    if (['HCM', '79', 'HN', '01'].includes(cityCode)) {
      fee = 15000;
    }

    // Logic hàng cồng kềnh (Ví dụ > 30kg)
    if (totalWeight > 30) {
      fee += 50000; // Phụ phí
    }

    return fee;
  }

  async handleVnpayIpn(vnpParams: VnpayReturnParams) {
    // const secureHash = vnpParams.vnp_SecureHash; // (Biến này chưa dùng)
    const orderId = vnpParams.vnp_TxnRef;
    const rspCode = vnpParams.vnp_ResponseCode;
    const isValidChecksum = this.verifyChecksum(vnpParams);
    if (!isValidChecksum) {
      return { RspCode: '97', Message: 'Invalid Checksum' };
    }

    // 2. Tìm đơn hàng
    const order = (await this.orderModel.findOne({
      order_code: orderId,
    })) as unknown as MongooseOrderDoc;

    if (!order) return { RspCode: '01', Message: 'Order not found' };

    // 3. Check số tiền
    const vnpAmount = vnpParams.vnp_Amount;
    const amount = parseInt(vnpAmount) / 100;

    if (order.total_amount !== amount) {
      return { RspCode: '04', Message: 'Invalid Amount' };
    }

    // 4. Cập nhật trạng thái
    if (order.payment.status === 'PAID') {
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    if (rspCode === '00') {
      // THANH TOÁN THÀNH CÔNG
      order.payment.status = 'PAID';
      order.status = 'CONFIRMED';
      order.hold_expires_at = undefined;

      // Timeline logic
      if (!order.timeline) order.timeline = [];
      order.timeline.push({
        status: 'PAID',
        timestamp: new Date(),
        actor: 'VNPay IPN',
        note: `Payment confirmed via VNPay (Txn: ${vnpParams.vnp_TransactionNo})`,
      });

      await order.save();

      return { RspCode: '00', Message: 'Confirm Success' };
    } else {
      // THANH TOÁN THẤT BẠI
      return { RspCode: '00', Message: 'Payment Failed confirmed' };
    }
  }

  async convertGuestToMember(orderId: string, password: string) {
    // 1. Tìm đơn hàng
    const order = await this.orderModel.findById(orderId);
    if (!order || !order.guest_info || !order.guest_info.email) {
      throw new BadRequestException('Đơn hàng không hợp lệ để tạo tài khoản');
    }

    // 2. Check xem email đã tồn tại chưa
    const existingUser = await this.connection
      .collection('users')
      .findOne({ email: order.guest_info.email });
    if (existingUser) {
      throw new BadRequestException(
        'Email này đã có tài khoản. Vui lòng đăng nhập.',
      );
    }

    // 3. Gọi UserService để tạo user mới
    const hashedPassword = await this.hashPassword(password);

    const newUser = await this.connection.collection('users').insertOne({
      email: order.guest_info.email,
      password: hashedPassword,
      name: order.guest_info.name,
      phone: order.guest_info.phone,
      createdAt: new Date(),
      role: 'CUSTOMER',
    });

    // 4. Cập nhật lại đơn hàng
    order.user_id = newUser.insertedId;
    (order as unknown as MongooseOrderDoc).isGuest = false;
    await (order as unknown as MongooseOrderDoc).save();

    return {
      success: true,
      message: 'Tạo tài khoản thành công',
      userId: newUser.insertedId,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  // Thêm hàm check checksum giả lập
  private verifyChecksum(vnpParams: VnpayReturnParams): boolean {
    const secureHash = vnpParams.vnp_SecureHash;
    const secretKey = process.env.VNP_HASH_SECRET || '';
    const vnpParamsObj: Record<string, any> = { ...vnpParams };

    delete vnpParamsObj['vnp_SecureHash'];
    delete vnpParamsObj['vnp_SecureHashType'];

    const sortedKeys = Object.keys(vnpParamsObj).sort();

    let signData = '';
    sortedKeys.forEach((key) => {
      const value = vnpParamsObj[key] as string | number;
      // Kiểm tra value tồn tại (loại trừ null/undefined nhưng giữ số 0)
      if (value !== null && value !== undefined && value !== '') {
        if (signData.length > 0) {
          signData += '&';
        }
        signData += `${key}=${encodeURIComponent(String(value))}`;
      }
    });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return secureHash === signed;
  }
}
