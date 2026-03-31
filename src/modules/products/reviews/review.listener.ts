import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import {
  NotificationType,
  NotificationPriority,
} from 'src/modules/notifications/schemas/notification-log.schema';

interface ReviewPublishedPayload {
  userId: string;
  reviewId: string;
  productId: string;
  orderId: string;
}

@Injectable()
export class ReviewEventListener {
  private readonly logger = new Logger(ReviewEventListener.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent(NOTIFY_EVENTS.REVIEW_PUBLISHED, { async: true })
  async handleReviewPublished(payload: ReviewPublishedPayload) {
    try {
      // AC15: Tích điểm (Gamification)
      const reviewPoints = 100;

      // 1. Cộng điểm trực tiếp vào collection users (Giống logic trong OrdersService)
      await this.connection
        .collection('users')
        .updateOne(
          { _id: new Types.ObjectId(payload.userId) },
          { $inc: { 'loyalty.point': reviewPoints } },
        );

      // 2. Ghi nhận lịch sử cộng điểm vào loyalty_histories
      await this.connection.collection('loyalty_histories').insertOne({
        user_id: new Types.ObjectId(payload.userId),
        order_id: new Types.ObjectId(payload.orderId),
        points: reviewPoints,
        action: 'EARN',
        reason: `Thưởng điểm viết đánh giá sản phẩm (Review ID: ${payload.reviewId})`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 3. AC18: Gửi thông báo cho người dùng
      // Định nghĩa kiểu rõ ràng cho Object gửi Notification để tránh lỗi Type
      const notiPayload = {
        recipient_role: 'CUSTOMER',
        recipient_id: payload.userId,
        title: 'Đánh giá của bạn đã được đăng!',
        message: `Đánh giá của bạn về sản phẩm đã được công khai. Bạn nhận được ${reviewPoints} điểm thưởng. Cảm ơn bạn đã chia sẻ!`,
        type: NotificationType.LOYALTY,
        priority: NotificationPriority.LOW,
        metadata: {
          target_url: `/product/${payload.productId}#reviews`,
          review_id: payload.reviewId,
        },
      };

      await this.notificationsService.createAndSend(notiPayload);

      this.logger.log(
        `[REVIEW EVENT] Đã cộng ${reviewPoints} điểm và gửi thông báo cho User ${payload.userId}`,
      );
    } catch (error: unknown) {
      // Ép kiểu error về unknown và check an toàn để pass qua rule no-unsafe-member-access của ESLint
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[REVIEW EVENT LỖI] User: ${payload.userId} - ${errorMessage}`,
      );
    }
  }
}
