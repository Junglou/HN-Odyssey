import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
  Inject,
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
import {
  PaymentStrategy,
  CreatePaymentUrlDto,
} from 'src/common/interfaces/payment-strategy.interface';
import {
  InvoiceOrder,
  VnpayReturnParams,
  OrderStatus,
} from 'src/common/interfaces/order.interface';
import { MomoService } from './providers/momo.service';
import { CodService } from './providers/cod.service';
import { OrdersService } from '../orders/orders.service';

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

    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
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
    dto: CreatePaymentUrlDto,
  ): Promise<string | null> {
    if (method === 'COD') return null;

    const strategy = this.strategies[method];
    if (!strategy) throw new BadRequestException('Phương thức không hỗ trợ');

    const config = await this.getConfig(method);

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

    const isValid = strategy.verifyWebhookData(config, rawData);
    if (!isValid) {
      this.logger.error(`[Security] Checksum Failed for ${provider}`);
      return { RspCode: '97', Message: 'Invalid Checksum' };
    }

    const { responseCode, amount, orderCode, transactionCode } =
      strategy.parseWebhookData(rawData);

    const lockKey = `lock:ipn:${orderCode}`;
    const acquired = await this.redis.set(lockKey, 'LOCKED', 'EX', 10, 'NX');
    if (!acquired)
      return { RspCode: '00', Message: 'Order already processing' };

    try {
      const order = await this.orderModel.findOne({ order_code: orderCode });
      if (!order) return { RspCode: '01', Message: 'Order Not Found' };

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

      if (responseCode === '00') {
        if (
          order.status === 'CANCELLED' &&
          String(order.cancel_reason).includes('timeout')
        ) {
          return this.processRecovery(order);
        }

        await this.ordersService.updateStatusAdvanced(
          String(order._id),
          {
            status: OrderStatus.CONFIRMED,
            note: `Thanh toán thành công qua ${provider}. Mã GD: ${transactionCode}`,
          },
          'SYSTEM_PAYMENT',
          `${provider}_GATEWAY`,
          '127.0.0.1',
          'IPN_HANDLER',
        );

        order.payment.status = 'PAID';
        order.payment.transaction_id = transactionCode;
        order.hold_expires_at = undefined;

        await order.save();
        await this.logTransaction(
          order,
          provider,
          rawData,
          'SUCCESS',
          'Payment Success',
        );
        return { RspCode: '00', Message: 'Confirm Success' };
      } else {
        order.payment.status = 'FAILED';
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
          const paymentLink = `${frontendUrl}/checkout/repay/${String(order._id)}`;
          void this.emailService.sendRepaymentLink(
            email,
            order.order_code,
            paymentLink,
          );
        }

        return { RspCode: '00', Message: 'Payment Failed Confirmed' };
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      this.logger.error(`IPN Error: ${msg}`);
      return { RspCode: '99', Message: 'System Error' };
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private async processRecovery(order: OrderDocument) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      let allItemsAvailable = true;
      for (const item of order.items) {
        const product = await this.productModel
          .findById(item.product_id)
          .session(session);
        const variant = product?.variants.find((v) => v.sku === item.sku);
        if (!variant || variant.stock < item.quantity) {
          allItemsAvailable = false;
          break;
        }
      }

      if (allItemsAvailable) {
        await this.ordersService.updateStatusAdvanced(
          String(order._id),
          {
            status: OrderStatus.CONFIRMED,
            reason: 'Khôi phục đơn hàng thành công do tiền về muộn.',
            is_override: true,
          },
          'SYSTEM_RECOVERY',
          'PAYMENT_RECOVERY_SERVICE',
          '127.0.0.1',
          'RECOVERY_AGENT',
        );

        order.payment.status = 'PAID';
        order.cancel_reason = undefined;
        await order.save({ session });
        await session.commitTransaction();

        const email = order.guest_info?.email || order.shipping_info?.email;
        if (email) {
          void this.emailService.sendInvoice(
            email,
            order as unknown as InvoiceOrder,
          );
        }
        return { RspCode: '00', Message: 'Order Recovered' };
      } else {
        // SỬA LẠI ĐOẠN NÀY:
        await this.ordersService.updateStatusAdvanced(
          String(order._id),
          {
            status: OrderStatus.REFUND_NEEDED,
            reason:
              'Khách thanh toán thành công nhưng hàng đã hết trong lúc chờ. Cần hoàn tiền ngay.',
            is_override: true,
          },
          'SYSTEM_PAYMENT',
          'PAYMENT_RECOVERY_SERVICE',
          '127.0.0.1',
          'RECOVERY_AGENT',
        );

        order.payment.status = 'REFUND_NEEDED';
        await order.save({ session });
        return { RspCode: '00', Message: 'Out of stock. Marked for Refund.' };
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
    let orderId: string | Types.ObjectId = new Types.ObjectId();
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

    if (
      String(order.status) !== String(OrderStatus.PENDING) ||
      order.payment.status === 'PAID'
    ) {
      throw new BadRequestException(
        'Đơn hàng không ở trạng thái chờ thanh toán.',
      );
    }

    const now = new Date();
    if (!order.hold_expires_at || new Date(order.hold_expires_at) < now) {
      await this.ordersService.updateStatusAdvanced(
        id,
        {
          status: OrderStatus.CANCELLED,
          reason: 'Phiên thanh toán hết hạn (15p)',
        },
        'SYSTEM',
        'CLEANUP_SERVICE',
        ip,
        'REPAY_LINK_REQUEST',
      );
      throw new BadRequestException('Phiên giao dịch đã hết hạn.');
    }

    const paymentUrl = await this.createPaymentUrl(order.payment.method, {
      orderCode: order.order_code,
      amount: order.total_amount,
      description: `Thanh toan lai don hang ${order.order_code}`,
      ipAddr: ip,
    });

    return {
      orderCode: order.order_code,
      paymentUrl,
      expiresAt: order.hold_expires_at,
    };
  }

  async verifyReturnUrl(query: VnpayReturnParams): Promise<boolean> {
    const config = await this.getConfig('VNPAY');
    return this.vnpayService.verifyReturnUrl(config, query);
  }

  async updatePaymentConfig(
    provider: string,
    updateData: Partial<PaymentConfig>,
  ) {
    const config = await this.configModel.findOneAndUpdate(
      { provider },
      { $set: updateData },
      { new: true },
    );
    if (!config)
      throw new NotFoundException(`Không tìm thấy cấu hình cổng ${provider}`);
    await this.redis.del(`payment_config:${provider}`);
    return { message: `Đã cập nhật cấu hình cổng ${provider}`, data: config };
  }

  async verifyProviderReturnUrl(
    provider: string,
    query: Record<string, unknown>,
  ): Promise<boolean> {
    const config = await this.getConfig(provider);
    const strategy = this.strategies[provider];
    if (!strategy) return false;

    if (provider === 'MOMO') return strategy.verifyWebhookData(config, query);
    if (provider === 'VNPAY') {
      return this.vnpayService.verifyReturnUrl(
        config,
        query as unknown as VnpayReturnParams,
      );
    }
    return false;
  }

  async processRefund(orderId: string, adminId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order || order.payment.status !== 'PAID') {
      throw new BadRequestException('Chỉ hoàn tiền đơn hàng đã thanh toán.');
    }

    const provider = order.payment.method;
    const strategy = this.strategies[provider];

    if (!strategy || !strategy.refundTransaction) {
      order.payment.status = 'REFUND_NEEDED';
      order.internal_note =
        'Cổng này chưa hỗ trợ hoàn tiền tự động. Cần xử lý thủ công.';
      await order.save();
      return { message: 'Đã chuyển trạng thái chờ hoàn tiền thủ công.' };
    }

    const config = await this.getConfig(provider);
    const paymentLog = await this.transactionModel.findOne({
      order_code: order.order_code,
      status: 'SUCCESS',
    });

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
        await this.ordersService.updateStatusAdvanced(
          String(order._id),
          {
            status: OrderStatus.CANCELLED,
            reason: `Hoàn tiền thành công qua ${provider}.`,
            is_override: true,
          },
          adminId,
          'ADMIN_REFUND',
          '127.0.0.1',
          'REFUND_AGENT',
        );

        order.payment.status = 'REFUNDED';
        await order.save();
        return { message: 'Hoàn tiền tự động thành công.' };
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown';
      this.logger.error(`Refund Failed: ${errMsg}`);
      throw new BadRequestException('Lỗi từ cổng thanh toán khi hoàn tiền.');
    }
  }
}
