import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order } from 'src/modules/sales/orders/schemas/order.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WarrantyItem } from './schemas/warranty-claim.schema';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { EmailService } from 'src/modules/notifications/channels/email.service';
import {
  NotificationPriority,
  NotificationType,
} from 'src/modules/notifications/schemas/notification-log.schema';

interface IOrderItemExtended {
  product_id: Types.ObjectId | string;
  product_name: string;
  warranty_months?: number;
}

@Injectable()
export class WarrantyListener {
  private readonly logger = new Logger(WarrantyListener.name);
  constructor(
    @InjectModel(WarrantyItem.name) private itemModel: Model<WarrantyItem>,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  //  AC1: Tự động kích hoạt khi Giao Hàng Thành Công
  @OnEvent('order.delivered')
  async handleOrderDelivered(order: Order) {
    this.logger.log(`Kích hoạt sổ bảo hành cho đơn hàng ${order.order_code}`);

    // 2. Ép kiểu an toàn (Type Casting) cho mảng items để fix lỗi "Property does not exist"
    const items = order.items as unknown as IOrderItemExtended[];

    const warrantyItems = items
      .filter((item) => item.warranty_months && item.warranty_months > 0) // Loại bỏ Móc khóa
      .map((item) => {
        const start = new Date();
        const end = new Date();

        // 3. Sử dụng fallback (|| 0) để đảm bảo tham số truyền vào luôn là number (Fix lỗi unsafe-argument)
        end.setMonth(start.getMonth() + (item.warranty_months || 0));

        return {
          order_id: order._id,
          order_code: order.order_code,
          customer_phone: order.shipping_info?.phone, // Thêm safe navigation cho chắc chắn
          product_id: item.product_id,
          product_name: item.product_name,
          start_date: start,
          end_date: end,
        };
      });

    if (warrantyItems.length > 0) {
      await this.itemModel.insertMany(warrantyItems);
    }
  }

  //  AC5: Job Nhắc nhở trước 7 ngày
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleWarrantyExpiryAlert() {
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);

    // 1. Tìm các sổ BH sắp hết hạn VÀ populate Order để lấy thông tin liên lạc
    const expiringItems = await this.itemModel
      .find({
        status: 'ACTIVE',
        end_date: {
          $gte: new Date(next7Days.setHours(0, 0, 0, 0)),
          $lt: new Date(next7Days.setHours(23, 59, 59, 999)),
        },
      })
      .populate('order_id'); // Populate để lấy thông tin từ bảng Order

    for (const item of expiringItems) {
      // 2. Ép kiểu an toàn để lấy data Order
      const order = item.order_id as unknown as Order;

      // Lấy Email và User ID
      const customerEmail =
        order?.shipping_info?.email ||
        (order as unknown as { user_email?: string }).user_email;
      const customerId = order?.user_id;

      const title = 'H&N Odyssey - Sản phẩm sắp hết hạn bảo hành';
      const message = `Sản phẩm "${item.product_name}" của bạn sắp hết hạn bảo hành sau 7 ngày nữa. Vui lòng kiểm tra lại tình trạng sản phẩm và liên hệ chúng tôi nếu cần hỗ trợ.`;

      this.logger.log(
        `[AC5] Đang xử lý nhắc nhở bảo hành cho Đơn: ${order.order_code} - SP: ${item.product_name}`,
      );

      // 3. GỬI EMAIL (Sử dụng try-catch để nếu 1 email lỗi không làm chết cả vòng lặp)
      if (customerEmail) {
        try {
          await this.emailService.sendRaw(customerEmail, title, message);
        } catch (error) {
          this.logger.error(
            `Lỗi gửi Email nhắc BH cho ${customerEmail}:`,
            error,
          );
        }
      }

      // 4. GỬI IN-APP NOTIFICATION (Nếu khách hàng có tài khoản ID)
      if (customerId) {
        try {
          await this.notificationsService.createAndSend({
            recipient_role: 'CUSTOMER',
            recipient_id: customerId.toString(),
            title: 'Sắp hết hạn bảo hành!',
            message: message,
            type: NotificationType.ORDER,
            priority: NotificationPriority.MEDIUM,
            metadata: {
              order_code: item.order_code,
              target_url: `/warranty/lookup?order_code=${String(item.order_code)}&phone=${String(item.customer_phone)}`,
            },
          });
        } catch (error) {
          this.logger.error(
            `Lỗi gửi In-App Notify BH cho user ${String(customerId)}:`,
            error,
          );
        }
      }
    }
  }
}
