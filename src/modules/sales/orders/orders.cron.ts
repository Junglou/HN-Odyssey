import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { Order } from './schemas/order.schema';
import { StockService } from 'src/modules/inventory/stock/stock.service';

@Injectable()
export class OrdersCronService {
  private readonly logger = new Logger(OrdersCronService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectConnection() private readonly connection: Connection,
    private readonly stockService: StockService,
  ) {}

  // Quét đơn hàng hết hạn giữ hàng (15 phút) mỗi phút
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredOrders() {
    const now = new Date();

    // Tìm các đơn hàng cần hủy (Guest chưa thanh toán hoặc BuyNow chưa chốt)
    const expiredOrders = await this.orderModel.find({
      status: { $in: ['PENDING', 'TEMPORARY'] },
      hold_expires_at: { $lte: now },
    });

    if (expiredOrders.length === 0) return;

    this.logger.log(
      `Found ${expiredOrders.length} expired orders. Processing cleanup...`,
    );

    // Xử lý từng đơn hàng trong một Transaction riêng biệt
    // (Để nếu 1 đơn lỗi thì không ảnh hưởng các đơn khác)
    for (const order of expiredOrders) {
      const session = await this.connection.startSession();
      session.startTransaction();

      try {
        // 1. Hoàn kho (Restock) thông qua StockService
        for (const item of order.items) {
          await this.stockService.restock(
            {
              product_id: item.product_id.toString(), // Đã ép kiểu string an toàn
              sku: item.sku,
              quantity: item.quantity,
            },
            session, // [FIX] Truyền session vào để đảm bảo an toàn
          );
        }

        // 2. Cập nhật trạng thái đơn hàng sang CANCELLED
        order.status = 'CANCELLED';
        // [QUAN TRỌNG] Lý do phải chứa chữ 'timeout' để logic handleVnpayIpn bắt được
        order.cancel_reason =
          'System: Auto cancel due to payment timeout (15m)';
        order.hold_expires_at = undefined; // Xóa field này để không bị quét lại

        // Lưu với session
        await order.save({ session });

        await session.commitTransaction();

        this.logger.log(
          `Successfully cancelled expired order: ${order.order_code}`,
        );
      } catch (error: any) {
        await session.abortTransaction();
        this.logger.error(
          `Failed to process expired order ${order.order_code}: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      } finally {
        await session.endSession();
      }
    }
  }
}
