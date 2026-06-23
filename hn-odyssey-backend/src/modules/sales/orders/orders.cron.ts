import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from './schemas/order.schema';
import { OrdersService } from './orders.service';
import { OrderStatus } from 'src/common/interfaces/order.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class OrdersCronService {
  private readonly logger = new Logger(OrdersCronService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private readonly ordersService: OrdersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Thêm lại quét đơn hết hạn (15 phút) mỗi phút một lần
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredOrders() {
    const now = new Date();
    const expiredOrders = await this.orderModel
      .find({
        status: { $in: [OrderStatus.PENDING, OrderStatus.TEMPORARY] },
        hold_expires_at: { $lte: now },
        'payment.status': { $ne: 'PAID' },
      })
      .limit(50);

    for (const order of expiredOrders) {
      const MAX_RETRIES = 3;
      let attempt = 0;
      let success = false;

      while (attempt < MAX_RETRIES && !success) {
        try {
          attempt++;
          await this.ordersService.updateStatusAdvanced(
            String(order._id),
            {
              status: OrderStatus.CANCELLED,
              reason: 'Hệ thống tự động hủy do hết hạn thanh toán (15 phút).',
            },
            'SYSTEM',
            'SYSTEM_CRON',
            '127.0.0.1',
            'Cronjob',
          );

          success = true; // Thành công thì đánh dấu để thoát vòng lặp while
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);

          // Xử lý Type-safe để vượt qua các strict rules của ESLint
          let isTransientError = false;
          if (typeof e === 'object' && e !== null && 'hasErrorLabel' in e) {
            const mongoErr = e as Record<string, unknown>;
            if (typeof mongoErr.hasErrorLabel === 'function') {
              isTransientError = (
                mongoErr.hasErrorLabel as (label: string) => boolean
              )('TransientTransactionError');
            }
          }

          // Xử lý cơ chế Retry nếu gặp lỗi Write Conflict từ MongoDB
          if (isTransientError || errorMessage.includes('Write conflict')) {
            if (attempt < MAX_RETRIES) {
              this.logger.warn(
                `Xung đột dữ liệu tại đơn ${order.order_code}, thử lại lần ${attempt}...`,
              );
              // Delay một khoảng thời gian ngắn để tiến trình khác hoàn tất, sau đó thử lại
              await new Promise((resolve) =>
                setTimeout(resolve, 150 * attempt),
              );
              continue;
            }
          }

          // Nếu không phải lỗi xung đột hoặc đã hết lượt thử (attempt >= MAX_RETRIES)
          this.logger.error(
            `Lỗi hủy đơn hết hạn ${order.order_code}: ${errorMessage}`,
          );

          // this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
          //   severity: 'HIGH',
          //   error_code: 'CRON_EXPIRED_ORDERS_FAILED',
          //   message: `Lỗi khi chạy Job hủy đơn tự động (Đơn: ${order.order_code}): ${errorMessage}`,
          //   stack_trace: e instanceof Error ? e.stack : undefined,
          // });

          break; // Thoát vòng while, tiếp tục với đơn hàng tiếp theo (order)
        }
      }
    }
  }

  // Quét đơn hàng hết hạn giữ hàng 7 ngày sau khi giao hàng thành công
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAutoCompletedOrders() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Tìm các đơn DELIVERED có updatedAt <= 7 ngày trước
    const ordersToComplete = await this.orderModel.find({
      status: OrderStatus.DELIVERED,
      updatedAt: { $lte: sevenDaysAgo },
      'payment.status': 'PAID',
    });

    if (ordersToComplete.length === 0) return;

    this.logger.log(
      `Tự động hoàn thành ${ordersToComplete.length} đơn hàng đã giao quá 7 ngày.`,
    );

    for (const order of ordersToComplete) {
      try {
        await this.ordersService.updateStatusAdvanced(
          String(order._id),
          {
            status: OrderStatus.COMPLETED,
            note: 'Hệ thống tự động hoàn thành sau 7 ngày giao hàng thành công.',
            is_override: true, // Bật cờ này lên để vượt qua runGuards
            reason:
              'Hệ thống tự động hoàn thành và ghi nhận dòng tiền đơn COD.',
          },
          'SYSTEM_ID',
          'SYSTEM_CRONJOB',
          '127.0.0.1',
          'Auto-Complete-Service',
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        this.logger.error(
          `Lỗi auto-complete đơn ${order.order_code}: ${errorMessage}`,
        );

        // this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
        //   severity: 'HIGH',
        //   error_code: 'CRON_AUTO_COMPLETE_FAILED',
        //   message: `Lỗi khi chạy Job hoàn thành đơn tự động (Đơn: ${order.order_code}): ${errorMessage}`,
        //   stack_trace: error instanceof Error ? error.stack : undefined,
        // });
      }
    }
  }
}
