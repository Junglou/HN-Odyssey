import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose'; // [FIX 1] Đã xóa 'Types'
import { VnpayService } from './providers/vnpay.service';
import { StockService } from 'src/modules/inventory/stock/stock.service';
import { EmailService } from 'src/modules/notifications/channels/email.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Product } from 'src/modules/products/catalog/schemas/product.schema';
import {
  VnpayReturnParams,
  InvoiceOrder,
} from 'src/common/interfaces/oder.interface';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly vnpayService: VnpayService,
    private readonly stockService: StockService,
    private readonly emailService: EmailService,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  // Tạo URL thanh toán
  createPaymentUrl(
    method: 'VNPAY' | 'MOMO' | 'COD',
    data: {
      orderCode: string;
      amount: number;
      description: string;
      ipAddr: string;
    },
  ): string | null {
    switch (method) {
      case 'VNPAY':
        return this.vnpayService.createPaymentUrl(
          data.orderCode,
          data.amount,
          data.description,
          data.ipAddr,
        );

      case 'MOMO':
        throw new BadRequestException('Phương thức MoMo đang bảo trì.');

      case 'COD':
        return null; // COD không cần URL thanh toán

      default:
        throw new BadRequestException(
          `Phương thức thanh toán ${method as string} không được hỗ trợ.`,
        );
    }
  }

  // Verify Webhook
  verifyPaymentWebhook(method: 'VNPAY' | 'MOMO', params: any): boolean {
    switch (method) {
      case 'VNPAY':
        return this.vnpayService.verifyReturnUrl(params as VnpayReturnParams);
      default:
        return false;
    }
  }

  // US.29 AC14: Lấy lại link thanh toán nếu đơn còn hạn giữ hàng
  async getRepaymentLink(id: string, ip: string) {
    // 1. Tìm đơn hàng
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    // 2. Validate trạng thái
    // Chỉ cho thanh toán lại nếu đơn đang PENDING và chưa thanh toán
    if (order.status !== 'PENDING' || order.payment.status === 'PAID') {
      throw new BadRequestException(
        'Đơn hàng không ở trạng thái chờ thanh toán.',
      );
    }

    // 3. Validate thời gian giữ hàng (Hold Stock)
    const now = new Date();
    if (!order.hold_expires_at || new Date(order.hold_expires_at) < now) {
      // Nếu hết hạn -> Hủy đơn luôn để user đặt lại (hoặc báo lỗi)
      order.status = 'CANCELLED';
      order.cancel_reason =
        'System: Payment link requested but session expired';
      await order.save();

      // (Optional) Gọi logic hoàn kho ở đây nếu cần thiết

      throw new BadRequestException(
        'Phiên giao dịch đã hết hạn (Quá 15 phút). Vui lòng đặt lại đơn hàng mới.',
      );
    }

    // 4. Tạo URL thanh toán VNPAY mới
    // Lưu ý: Bạn cần dùng logic tạo URL giống lúc createOrder.
    // Ở đây tôi giả lập hàm build URL, bạn hãy thay bằng VnpayService của bạn.
    const vnpayUrl = this.vnpayService.createPaymentUrl(
      order.order_code,
      order.total_amount,
      `Thanh toan lai don hang ${order.order_code}`,
      ip,
    );

    return {
      orderCode: order.order_code,
      paymentUrl: vnpayUrl,
      expiresAt: order.hold_expires_at, // Trả về để FE đếm ngược
    };
  }

  // Xử lý IPN từ VNPAY
  async handleVnpayIpn(vnpParams: VnpayReturnParams) {
    const orderId = vnpParams.vnp_TxnRef;
    const rspCode = vnpParams.vnp_ResponseCode;

    // 1. Verify checksum
    const isValidChecksum = this.vnpayService.verifyReturnUrl(vnpParams);
    if (!isValidChecksum) {
      return { RspCode: '97', Message: 'Invalid Checksum' };
    }

    // 2. Tìm đơn hàng
    const order = await this.orderModel.findOne({ order_code: orderId });

    if (!order) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    // 3. Check số tiền
    const amount = Number(vnpParams.vnp_Amount) / 100;
    if (order.total_amount !== amount) {
      return { RspCode: '04', Message: 'Invalid Amount' };
    }

    // 4. KHÔI PHỤC ĐƠN HÀNG NẾU ĐÃ BỊ HỦY DO TIMEOUT (Logic Hồi sinh)
    if (
      order.status === 'CANCELLED' &&
      order.cancel_reason &&
      String(order.cancel_reason).includes('timeout') &&
      rspCode === '00'
    ) {
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
          // A. NẾU CÒN HÀNG: Trừ kho lại
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
            note: 'Khôi phục đơn hàng do tiền về muộn (Timeout)',
          });

          await order.save({ session });
          await session.commitTransaction();

          // Gửi email hóa đơn (không await để tránh block)
          void this.emailService
            .sendInvoice(
              order.guest_info?.email || order.shipping_info?.email || '',
              // [FIX 3] Cast về unknown trước rồi mới sang Interface để tránh lỗi unsafe
              order as unknown as InvoiceOrder,
            )
            .catch((e) => this.logger.error('Error sending invoice', e));

          return { RspCode: '00', Message: 'Order recovered and confirmed' };
        } else {
          // B. NẾU HẾT HÀNG: Hoàn tiền
          order.payment.status = 'REFUND_NEEDED';
          order.internal_note = `Khách thanh toán thành công lúc ${new Date().toISOString()} nhưng đơn bị hủy do Timeout và hết hàng. Cần refund ${amount} VNĐ.`;
          order.timeline.push({
            status: 'CANCELLED',
            timestamp: new Date(),
            actor: 'System (Error)',
            note: 'Tiền đã về nhưng không thể khôi phục đơn (Hết hàng). Cần hoàn tiền.',
          });

          await order.save({ session });
          await session.commitTransaction();

          // Gửi cảnh báo Admin
          try {
            const adminEmail =
              process.env.ADMIN_EMAIL_NOTIFICATIONS || 'admin@hn-odyssey.com';
            await this.emailService.sendRaw(
              adminEmail,
              `[URGENT] YÊU CẦU HOÀN TIỀN - Đơn hàng #${order.order_code}`,
              `
              <h3>Cảnh báo hoàn tiền gấp</h3>
              <p>Đơn hàng <b>${order.order_code}</b> gặp sự cố:</p>
              <ul>
                  <li>Khách đã thanh toán: <b>${amount.toLocaleString()} VNĐ</b></li>
                  <li>Trạng thái đơn: Đã bị hủy do Timeout</li>
                  <li>Tình trạng kho: HẾT HÀNG (Không thể khôi phục)</li>
              </ul>
              <p style="color: red; font-weight: bold;">Vui lòng kiểm tra cổng thanh toán và hoàn tiền thủ công cho khách hàng.</p>
              `,
            );
          } catch (e) {
            this.logger.error('Failed to send refund alert email', e);
          }

          return {
            RspCode: '00',
            Message: 'Payment received but Out of Stock. Marked for Refund.',
          };
        }
      } catch (error: unknown) {
        await session.abortTransaction();
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Lỗi khôi phục đơn hàng timeout:', errorMessage);
        return { RspCode: '99', Message: 'System Error during Recovery' };
      } finally {
        await session.endSession();
      }
    }

    // 5. Nếu đơn đã PAID -> Bỏ qua
    if (order.payment.status === 'PAID') {
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    // 6. Xử lý kết quả thanh toán chính thức
    if (rspCode === '00') {
      const session = await this.connection.startSession();
      session.startTransaction();

      try {
        order.payment.status = 'PAID';
        order.status = 'CONFIRMED';
        order.hold_expires_at = undefined;

        const isGuestOrder = !order.user_id;

        if (isGuestOrder) {
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
        } else {
          this.logger.log(
            `[IPN] Member order ${order.order_code}: Stock check skipped (Already deducted).`,
          );
        }

        order.timeline = order.timeline || [];
        order.timeline.push({
          status: 'PAID',
          timestamp: new Date(),
          actor: 'VNPay IPN',
          note: `Thanh toán thành công (Mã GD: ${vnpParams.vnp_TransactionNo})`,
        });

        await order.save({ session });
        await session.commitTransaction();

        return { RspCode: '00', Message: 'Confirm Success' };
      } catch (error: unknown) {
        await session.abortTransaction();
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Lỗi commit stock IPN:', errorMessage);
        return { RspCode: '99', Message: 'Unknown Error' };
      } finally {
        await session.endSession();
      }
    }

    // 7. THANH TOÁN THẤT BẠI
    order.payment.status = 'FAILED';
    order.timeline = order.timeline || [];
    order.timeline.push({
      status: 'FAILED',
      timestamp: new Date(),
      actor: 'VNPay IPN',
      note: `Payment failed (RspCode: ${rspCode})`,
    });

    await order.save();

    const email = order.guest_info?.email || order.shipping_info?.email;
    if (email) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const paymentLink = `${frontendUrl}/checkout/repay/${String(order._id)}`;

      void this.emailService.sendRepaymentLink(
        email,
        order.order_code,
        paymentLink,
      );
    }

    return { RspCode: '00', Message: 'Payment Failed confirmed' };
  }
}
