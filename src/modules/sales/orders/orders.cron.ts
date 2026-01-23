import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from './schemas/order.schema';
import { StockService } from 'src/modules/inventory/stock/stock.service';

@Injectable()
export class OrdersCronService {
  private readonly logger = new Logger(OrdersCronService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
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

    for (const order of expiredOrders) {
      try {
        // 1. Hoàn kho (Restock) thông qua StockService
        for (const item of order.items) {
          await this.stockService.restock({
            product_id: item.product_id.toString(), // Đã ép kiểu string an toàn
            sku: item.sku,
            quantity: item.quantity,
          });
        }

        // 2. Cập nhật trạng thái đơn hàng sang CANCELLED
        order.status = 'CANCELLED';
        order.cancel_reason =
          'System: Auto cancel due to payment timeout (15m)';
        order.hold_expires_at = undefined; // Xóa field này để không bị quét lại

        await order.save();

        this.logger.log(
          `Successfully cancelled expired order: ${order.order_code}`,
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to process expired order ${order.order_code}: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
