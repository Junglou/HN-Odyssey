import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from './schemas/order.schema';
import { Product } from '../../products/catalog/schemas/product.schema';

@Injectable()
export class OrdersCronService {
  private readonly logger = new Logger(OrdersCronService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Product.name) private productModel: Model<Product>,
  ) {}

  // AC10 (Buy Now): Tự động hoàn trả tồn kho nếu hết giờ giữ hàng (15p)
  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredOrders() {
    const now = new Date();

    // Quét cả đơn PENDING (Checkout xong chưa thanh toán) và TEMPORARY (Bấm Mua ngay nhưng không checkout)
    const expiredOrders = await this.orderModel.find({
      status: { $in: ['PENDING', 'TEMPORARY'] },
      hold_expires_at: { $lt: now },
    });

    for (const order of expiredOrders) {
      this.logger.log(`Releasing stock for expired order: ${order.order_code}`);

      // Hoàn tồn kho cho từng item
      for (const item of order.items) {
        await this.productModel.updateOne(
          { _id: item.product_id, 'variants.sku': item.sku },
          { $inc: { 'variants.$.stock': item.quantity } },
        );
      }

      // Cập nhật trạng thái đơn
      order.status = 'CANCELLED';
      order.cancel_reason = 'Hết thời gian giữ hàng (Payment Timeout)';
      await order.save();
    }
  }
}
