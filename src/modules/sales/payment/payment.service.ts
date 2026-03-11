import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { VnpayService } from './providers/vnpay.service';
import { StockService } from 'src/modules/inventory/stock/stock.service';
import { EmailService } from 'src/modules/notifications/channels/email.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Product } from 'src/modules/products/catalog/schemas/product.schema';
import {
  PaymentConfig,
  PaymentConfigDocument,
} from './schemas/payment-config.schema';
import {
  PaymentTransaction,
  PaymentTransactionDocument,
} from './schemas/payment-transaction.schema';
import { PaymentStrategy } from 'src/common/interfaces/payment-strategy.interface';
import {
  InvoiceOrder,
  VnpayReturnParams,
} from 'src/common/interfaces/order.interface';
import { MomoService } from './providers/momo.service';
import { CodService } from './providers/cod.service';

type LogOrderContext = {
  order_code: string;
  total_amount: number;
  _id?: Types.ObjectId | string;
};

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private strategies: Record<string, PaymentStrategy> = {};

  constructor(
    private readonly vnpayService: VnpayService,
    private readonly momoService: MomoService,
    private readonly stockService: StockService,
    private readonly emailService: EmailService,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(PaymentConfig.name)
    private readonly configModel: Model<PaymentConfigDocument>,
    @InjectModel(PaymentTransaction.name)
    private readonly transactionModel: Model<PaymentTransactionDocument>,
    @InjectRedis() private readonly redis: Redis,
    @InjectConnection() private readonly connection: Connection,
    private readonly codService: CodService,
  ) {
    this.strategies['VNPAY'] = this.vnpayService;
    this.strategies['MOMO'] = this.momoService;
    this.strategies['COD'] = this.codService;
  }

  private async getConfig(provider: string): Promise<PaymentConfig> {
    const cacheKey = `payment_config:${provider}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as PaymentConfig;

    const config = await this.configModel
      .findOne({ provider, is_active: true })
      .lean();
    if (!config)
      throw new BadRequestException(
        `Cổng thanh toán ${provider} đang bảo trì.`,
      );

    const typedConfig = config as unknown as PaymentConfig;
    await this.redis.set(cacheKey, JSON.stringify(typedConfig), 'EX', 300);
    return typedConfig;
  }

  async createPaymentUrl(
    method: string,
    dto: {
      orderCode: string;
      amount: number;
      description: string;
      ipAddr: string;
    },
  ): Promise<string | null> {
    if (method === 'COD') return null;

    const strategy = this.strategies[method];
    if (!strategy) throw new BadRequestException('Phương thức không hỗ trợ');

    const config = await this.getConfig(method);

    // Tạo Mock Object chuẩn Type LogOrderContext
    const mockOrder: LogOrderContext = {
      order_code: dto.orderCode,
      total_amount: dto.amount,
      _id: new Types.ObjectId(),
    };

    await this.logTransaction(
      mockOrder,
      method,
      dto,
      'PENDING',
      'Created Payment URL',
    );

    return strategy.createPaymentUrl(config, dto);
  }

  async handleIpn(provider: string, rawData: Record<string, unknown>) {
    const strategy = this.strategies[provider];
    if (!strategy) return { RspCode: '99', Message: 'Unknown Provider' };

    const config = await this.getConfig(provider);

    // 1. Verify Checksum
    const isValid = strategy.verifyWebhookData(config, rawData);
    if (!isValid) {
      this.logger.error(`[Security] Checksum Failed for ${provider}`);
      return { RspCode: '97', Message: 'Invalid Checksum' };
    }

    // 2. Parse Data
    const { responseCode, amount, orderCode, transactionCode } =
      strategy.parseWebhookData(rawData);

    // 3. IDEMPOTENCY CHECK - Redis Lock
    const lockKey = `lock:ipn:${orderCode}`;
    const acquired = await this.redis.set(lockKey, 'LOCKED', 'EX', 10, 'NX');

    if (!acquired) {
      return { RspCode: '00', Message: 'Order already processing' };
    }

    try {
      const order = await this.orderModel.findOne({ order_code: orderCode });
      if (!order) return { RspCode: '01', Message: 'Order Not Found' };

      // Validate Amount
      if (order.total_amount !== amount) {
        await this.logTransaction(
          order,
          provider,
          rawData,
          'FAILED',
          'Invalid Amount',
        );
        return { RspCode: '04', Message: 'Invalid Amount' };
      }

      if (order.payment.status === 'PAID') {
        return { RspCode: '00', Message: 'Order already confirmed' };
      }

      // XỬ LÝ KẾT QUẢ
      if (responseCode === '00') {
        // A. LOGIC HỒI SINH ĐƠN HÀNG
        if (
          order.status === 'CANCELLED' &&
          String(order.cancel_reason).includes('timeout')
        ) {
          // Xóa các tham số thừa khi gọi hàm
          return this.processRecovery(order);
        }

        // B. LOGIC THANH TOÁN THƯỜNG
        const session = await this.connection.startSession();
        session.startTransaction();
        try {
          order.payment.status = 'PAID';
          order.status = 'CONFIRMED';
          order.hold_expires_at = undefined;

          if (!order.user_id) {
            for (const item of order.items) {
              await this.stockService.finalizeDeduction(
                {
                  product_id: String(item.product_id),
                  sku: item.sku,
                  quantity: item.quantity,
                },
                session,
              );
            }
          }

          order.timeline = order.timeline || [];
          order.timeline.push({
            status: 'PAID',
            timestamp: new Date(),
            actor: `${provider} IPN`,
            note: `Thanh toán thành công (Mã GD: ${transactionCode})`,
          });

          await order.save({ session });
          await session.commitTransaction();

          await this.logTransaction(
            order,
            provider,
            rawData,
            'SUCCESS',
            'Payment Success',
          );

          return { RspCode: '00', Message: 'Confirm Success' };
        } catch (e) {
          await session.abortTransaction();
          throw e;
        } finally {
          await session.endSession();
        }
      } else {
        // THANH TOÁN THẤT BẠI
        order.payment.status = 'FAILED';
        order.timeline.push({
          status: 'FAILED',
          timestamp: new Date(),
          actor: `${provider} IPN`,
          note: `Payment Failed: ${responseCode}`,
        });
        await order.save();
        await this.logTransaction(
          order,
          provider,
          rawData,
          'FAILED',
          `Gateway Error: ${responseCode}`,
        );

        const email = order.guest_info?.email || order.shipping_info?.email;
        if (email) {
          const frontendUrl =
            process.env.FRONTEND_URL || 'http://localhost:5173';
          const paymentLink = `${frontendUrl}/checkout/repay/${String(
            order._id,
          )}`;
          void this.emailService.sendRepaymentLink(
            email,
            order.order_code,
            paymentLink,
          );
        }

        return { RspCode: '00', Message: 'Payment Failed Confirmed' };
      }
    } catch (e) {
      this.logger.error(e);
      return { RspCode: '99', Message: 'System Error' };
    } finally {
      await this.redis.del(lockKey);
    }
  }

  // Xóa hẳn các tham số thừa provider, rawData, txnCode
  private async processRecovery(order: OrderDocument) {
    if (order.status !== 'CANCELLED') {
      this.logger.warn(
        `Skip recovery for order ${order.order_code}: Status is ${order.status}`,
      );
      return { RspCode: '00', Message: 'Order not cancelled, skip recovery' };
    }

    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      let allItemsAvailable = true;
      for (const item of order.items) {
        const product = await this.productModel
          .findById(item.product_id)
          .session(session);
        if (!product) {
          allItemsAvailable = false;
          break;
        }
        const variant = product.variants.find((v) => v.sku === item.sku);
        if (!variant || variant.stock < item.quantity) {
          allItemsAvailable = false;
          break;
        }
      }

      if (allItemsAvailable) {
        for (const item of order.items) {
          await this.productModel
            .updateOne(
              { _id: item.product_id, 'variants.sku': item.sku },
              { $inc: { 'variants.$.stock': -item.quantity } },
            )
            .session(session);
        }
        order.status = 'CONFIRMED';
        order.payment.status = 'PAID';
        order.cancel_reason = undefined;
        order.timeline.push({
          status: 'CONFIRMED',
          timestamp: new Date(),
          actor: 'System (Recovery)',
          note: 'Khôi phục đơn hàng do tiền về muộn',
        });

        await order.save({ session });
        await session.commitTransaction();

        const email = order.guest_info?.email || order.shipping_info?.email;
        if (email) {
          void this.emailService
            .sendInvoice(email, order as unknown as InvoiceOrder)
            .catch((e) => this.logger.error('Error sending invoice', e));
        }
        return { RspCode: '00', Message: 'Order Recovered' };
      } else {
        order.payment.status = 'REFUND_NEEDED';
        order.internal_note = `Khách thanh toán thành công lúc ${new Date().toISOString()} nhưng đơn bị hủy do Timeout và hết hàng.`;
        await order.save({ session });
        await session.commitTransaction();

        return {
          RspCode: '00',
          Message: 'Payment received but Out of Stock. Marked for Refund.',
        };
      }
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      await session.endSession();
    }
  }

  private async logTransaction(
    order: LogOrderContext | OrderDocument,
    provider: string,
    data: any,
    status: string,
    msg: string,
  ) {
    // Dùng Type Guard để lấy ID an toàn
    let orderId: string | Types.ObjectId = new Types.ObjectId();

    // Kiểm tra nếu object có thuộc tính _id và nó không null/undefined
    if ('_id' in order && order._id) {
      orderId = order._id;
    }

    await this.transactionModel.create({
      order_code: order.order_code,
      order_id: orderId,
      provider,
      type: 'PAYMENT',
      amount: order.total_amount,
      request_data: status === 'PENDING' ? data : undefined,
      response_data: status !== 'PENDING' ? data : undefined,
      status,
      message: msg,
    });
  }

  async getRepaymentLink(id: string, ip: string) {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    if (order.status !== 'PENDING' || order.payment.status === 'PAID') {
      throw new BadRequestException(
        'Đơn hàng không ở trạng thái chờ thanh toán.',
      );
    }
    const now = new Date();
    if (!order.hold_expires_at || new Date(order.hold_expires_at) < now) {
      order.status = 'CANCELLED';
      order.cancel_reason =
        'System: Payment link requested but session expired';
      await order.save();
      throw new BadRequestException('Phiên giao dịch đã hết hạn.');
    }

    // Gọi hàm createPaymentUrl với tham số động là order.payment.method
    const paymentUrl = await this.createPaymentUrl(order.payment.method, {
      orderCode: order.order_code,
      amount: order.total_amount,
      description: `Thanh toan lai don hang ${order.order_code}`,
      ipAddr: ip,
    });

    return {
      orderCode: order.order_code,
      paymentUrl: paymentUrl,
      expiresAt: order.hold_expires_at,
    };
  }

  async verifyReturnUrl(query: VnpayReturnParams): Promise<boolean> {
    // 1. Lấy Config của VNPAY từ Redis/DB
    const config = await this.getConfig('VNPAY');

    // 2. Truyền config vào hàm verify của provider
    return this.vnpayService.verifyReturnUrl(config, query);
  }

  async updatePaymentConfig(
    provider: string,
    updateData: Partial<PaymentConfig>,
  ) {
    const config = await this.configModel.findOneAndUpdate(
      { provider },
      { $set: updateData },
      { new: true }, // Bỏ upsert: true theo chuẩn HTTP PATCH
    );

    if (!config) {
      throw new NotFoundException(
        `Không tìm thấy cấu hình cho cổng ${provider}`,
      );
    }

    // Xóa cache Redis để hệ thống lấy cấu hình mới nhất ngay lập tức
    await this.redis.del(`payment_config:${provider}`);

    return {
      message: `Đã cập nhật cấu hình cổng ${provider}`,
      data: config,
    };
  }

  // Dùng chung cho cả Momo và Vnpay Return URL
  async verifyProviderReturnUrl(
    provider: string,
    query: Record<string, unknown>,
  ): Promise<boolean> {
    const config = await this.getConfig(provider);
    const strategy = this.strategies[provider];

    if (!strategy) {
      return false;
    }

    // MoMo sử dụng chung cơ chế ký số cho cả Webhook và Return URL
    if (provider === 'MOMO') {
      return strategy.verifyWebhookData(config, query);
    }

    // VNPAY có logic tính checksum Return URL hơi khác so với IPN
    if (provider === 'VNPAY') {
      return this.vnpayService.verifyReturnUrl(
        config,
        query as unknown as VnpayReturnParams,
      );
    }

    return false;
  }

  // US2.AC4: Quy trình Hoàn tiền
  async processRefund(orderId: string, adminId: string) {
    const order = await this.orderModel.findById(orderId);

    // AC4: Chỉ hoàn tiền đơn đã PAID
    if (!order || order.payment.status !== 'PAID') {
      throw new BadRequestException(
        'Chỉ hỗ trợ hoàn tiền đơn hàng đã thanh toán.',
      );
    }

    const provider = order.payment.method;
    const strategy = this.strategies[provider];

    if (!strategy || !strategy.refundTransaction) {
      // Logic fallback nếu cổng chưa hỗ trợ API tự động
      order.payment.status = 'REFUND_NEEDED';
      order.internal_note =
        'Cổng này chưa hỗ trợ hoàn tiền tự động. Cần xử lý thủ công.';
      await order.save();
      return { message: 'Đã chuyển trạng thái chờ hoàn tiền thủ công.' };
    }

    const config = await this.getConfig(provider);

    // AC6: Tra cứu từ bảng Payment Logs (TransactionModel)
    const paymentLog = await this.transactionModel.findOne({
      order_code: order.order_code,
      status: 'SUCCESS',
    });

    // Sử dụng hàm getRefundDate đã chuẩn hóa ở Bước 2
    const transDate = strategy.getRefundDate(
      (paymentLog?.response_data as Record<string, unknown>) || {},
    );

    try {
      const isRefundSuccess = await strategy.refundTransaction(
        config,
        order.order_code,
        order.total_amount,
        transDate,
        adminId,
      );

      if (isRefundSuccess) {
        order.payment.status = 'REFUNDED';
        order.status = 'CANCELLED';
        order.timeline.push({
          status: 'REFUNDED',
          timestamp: new Date(),
          actor: adminId,
          note: `Hoàn tiền tự động thành công qua ${provider}`,
        });
        await order.save();

        // AC7: Ghi log an ninh (Audit Log)
        await this.logTransaction(
          order,
          provider,
          {},
          'SUCCESS',
          'Refund Completed',
        );
        return { message: 'Hoàn tiền tự động thành công.' };
      }
    } catch (error: unknown) {
      this.logger.error(
        `Refund Failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      throw new BadRequestException(
        'Lỗi từ cổng thanh toán khi thực hiện hoàn tiền.',
      );
    }
  }
}
