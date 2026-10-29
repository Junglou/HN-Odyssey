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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';

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
    private readonly eventEmitter: EventEmitter2,

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

      const tolerance = 0.05;
      if (Math.abs(order.total_amount - amount) > tolerance) {
        await this.logTransaction(
          order,
          provider,
          rawData,
          'FAILED',
          `Invalid Amount: Expected ${order.total_amount}, got ${amount}`,
        );
        return { RspCode: '04', Message: 'Invalid Amount' };
      }

      if (order.payment.status === 'PAID') {
        // VNPAY quy định: 02 = đơn đã được xác nhận trước đó
        return { RspCode: '02', Message: 'Order already confirmed' };
      }

      if (responseCode === '00' || responseCode === '0') {
        // Tiền về cho một đơn ĐÃ BỊ HỦY (thường: hết hạn 15 phút rồi khách mới thanh toán xong).
        // Trước đây chỉ bắt chuỗi 'timeout' — không khớp lý do hủy thật nên luồng này không bao giờ chạy.
        if (order.status === 'CANCELLED') {
          return this.processRecovery(
            order,
            provider,
            rawData,
            transactionCode,
          );
        }

        await this.ordersService.updateStatusAdvanced(
          String(order._id),
          {
            status: OrderStatus.CONFIRMED,
            note: `Payment successful via ${provider}. Transaction ID: ${transactionCode}`,
          },
          'SYSTEM_PAYMENT',
          `${provider}_GATEWAY`,
          '127.0.0.1',
          'IPN_HANDLER',
        );

        await this.orderModel.updateOne(
          { _id: order._id },
          {
            $set: {
              'payment.status': 'PAID',
              'payment.transaction_id': transactionCode,
            },
            $unset: { hold_expires_at: 1 }, // Xóa field đếm ngược thời gian
          },
        );

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

        this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
          severity: 'HIGH', // Lỗi thanh toán là lỗi quan trọng
          error_code: `PAYMENT_FAILED_${provider}`,
          message: `Giao dịch thanh toán thất bại cho đơn hàng ${order.order_code}. Cổng: ${provider}, Mã lỗi trả về: ${responseCode}`,
        });

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

  /**
   * Tiền về cho đơn đã bị hủy:
   *  - Hủy do HẾT HẠN thanh toán và còn hàng → khôi phục đơn, GIỮ HÀNG LẠI, xác nhận.
   *  - Hết hàng, hoặc đơn bị hủy chủ động → đánh dấu CẦN HOÀN TIỀN và báo ngay cho nhân sự.
   * Không bọc transaction ngoài: updateStatusAdvanced tự chạy transaction riêng,
   * lồng thêm một transaction ở đây sẽ gây xung đột ghi (WriteConflict) trên cùng đơn.
   */
  private async processRecovery(
    order: OrderDocument,
    provider: string,
    rawData: Record<string, unknown>,
    transactionCode: string,
  ) {
    const orderId = String(order._id);
    const cancelledByExpiry = /hết hạn|expired|timeout/i.test(
      String(order.cancel_reason ?? ''),
    );

    if (cancelledByExpiry) {
      let restored = false;
      try {
        // 1. Gỡ hạn 15 phút trước, để cron không hủy lại đơn giữa chừng
        await this.orderModel.updateOne(
          { _id: order._id },
          { $unset: { hold_expires_at: 1 } },
        );

        // 2. CANCELLED → PENDING (override): updateStatusAdvanced GIỮ HÀNG LẠI ở bước này.
        //    Hết hàng thì holdStock báo lỗi → rơi xuống nhánh cần hoàn tiền.
        await this.ordersService.updateStatusAdvanced(
          orderId,
          {
            status: OrderStatus.PENDING,
            reason:
              'Late payment received: order restored and stock re-reserved.',
            is_override: true,
          },
          'SYSTEM_RECOVERY',
          'PAYMENT_RECOVERY_SERVICE',
          '127.0.0.1',
          'RECOVERY_AGENT',
          true, // lệnh hệ thống
        );
        restored = true;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Không khôi phục được đơn ${order.order_code} (${msg}). Chuyển sang cần hoàn tiền.`,
        );
      }

      if (restored) {
        // 3. Ghi nhận đã thanh toán
        await this.orderModel.updateOne(
          { _id: order._id },
          {
            $set: {
              'payment.status': 'PAID',
              'payment.transaction_id': transactionCode,
            },
            $unset: { cancel_reason: 1 },
          },
        );

        // 4. PENDING → CONFIRMED theo đúng quy trình (không override)
        try {
          await this.ordersService.updateStatusAdvanced(
            orderId,
            {
              status: OrderStatus.CONFIRMED,
              note: `Payment successful via ${provider} (received after expiry). Transaction ID: ${transactionCode}`,
            },
            'SYSTEM_PAYMENT',
            `${provider}_GATEWAY`,
            '127.0.0.1',
            'IPN_HANDLER',
            true,
          );
        } catch (error: unknown) {
          // Đơn đã giữ hàng + đã PAID, chỉ chưa tự xác nhận → Sales xác nhận tay, không mất gì
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Đơn ${order.order_code} đã khôi phục và thanh toán nhưng chưa tự xác nhận được: ${msg}`,
          );
        }

        await this.logTransaction(
          order,
          provider,
          rawData,
          'SUCCESS',
          'Payment Success (recovered after expiry)',
        );

        const email = order.guest_info?.email || order.shipping_info?.email;
        if (email) {
          void this.emailService.sendInvoice(
            email,
            order as unknown as InvoiceOrder,
          );
        }
        return { RspCode: '00', Message: 'Order Recovered' };
      }
    }

    // NHÁNH CẦN HOÀN TIỀN: hết hàng, hoặc đơn đã bị hủy chủ động trước khi tiền về
    await this.ordersService.updateStatusAdvanced(
      orderId,
      {
        status: OrderStatus.REFUND_NEEDED,
        reason: cancelledByExpiry
          ? 'Customer paid after the order expired, but the items are out of stock. Refund required.'
          : 'Customer paid for an order that had already been cancelled. Refund required.',
        is_override: true,
      },
      'SYSTEM_PAYMENT',
      'PAYMENT_RECOVERY_SERVICE',
      '127.0.0.1',
      'RECOVERY_AGENT',
      true, // lệnh hệ thống
    );

    await this.orderModel.updateOne(
      { _id: order._id },
      {
        $set: {
          'payment.status': 'REFUND_NEEDED',
          'payment.transaction_id': transactionCode,
        },
      },
    );

    await this.logTransaction(
      order,
      provider,
      rawData,
      'SUCCESS',
      'Payment received for cancelled order — refund needed',
    );

    // Tiền của khách đang nằm trên đơn đã hủy → báo ngay (CRITICAL: popup + email + Slack)
    this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
      severity: 'CRITICAL',
      error_code: `PAYMENT_REFUND_NEEDED_${order.order_code}`,
      message: `Đơn ${order.order_code} đã bị hủy nhưng khách vừa thanh toán thành công qua ${provider}. Cần hoàn tiền cho khách.`,
    });

    return {
      RspCode: '00',
      Message: 'Cancelled order paid. Marked for Refund.',
    };
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
          reason: 'Payment session expired (15 min)',
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
            reason: `Refund completed via ${provider}.`,
            is_override: true,
          },
          adminId,
          'ADMIN_REFUND',
          '127.0.0.1',
          'REFUND_AGENT',
          // Hoàn tiền đã được kiểm soát bằng quyền REFUND riêng → không đòi thêm cấp Board
          true,
        );

        order.payment.status = 'REFUNDED';
        await order.save();
        return { message: 'Hoàn tiền tự động thành công.' };
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown';
      this.logger.error(`Refund Failed: ${errMsg}`);

      this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
        severity: 'HIGH',
        error_code: `REFUND_API_ERROR_${provider}`,
        message: `Lỗi kết nối/xử lý từ cổng ${provider} khi yêu cầu hoàn tiền đơn ${order.order_code}. Chi tiết: ${errMsg}`,
        stack_trace: error instanceof Error ? error.stack : undefined,
      });

      throw new BadRequestException('Lỗi từ cổng thanh toán khi hoàn tiền.');
    }
  }
}
