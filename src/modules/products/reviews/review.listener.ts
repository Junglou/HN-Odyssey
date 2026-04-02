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

interface ReviewDeletedPayload {
  userId: string;
  reviewId: string;
  orderId: string;
  reason: string; // 'USER_DELETED' | 'ADMIN_DELETED' | 'ADMIN_HIDDEN'
}

interface ReviewRepliedPayload {
  userId: string;
  reviewId: string;
  productId: string;
  replyContent: string;
}

@Injectable()
export class ReviewEventListener {
  private readonly logger = new Logger(ReviewEventListener.name);
  private readonly REVIEW_REWARD_POINTS = 100;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly notificationsService: NotificationsService,
  ) {}

  // 1. LUỒNG ĐĂNG BÀI: CỘNG ĐIỂM & THÔNG BÁO (Đã tối ưu)
  @OnEvent(NOTIFY_EVENTS.REVIEW_PUBLISHED, { async: true })
  async handleReviewPublished(payload: ReviewPublishedPayload) {
    try {
      // Check xem đơn hàng này đã từng được cộng điểm review chưa để chống cày điểm
      const existingReward = await this.connection
        .collection('loyalty_histories')
        .findOne({
          user_id: new Types.ObjectId(payload.userId),
          order_id: new Types.ObjectId(payload.orderId),
          action: 'EARN',
          reason: { $regex: 'Thưởng điểm viết đánh giá' },
        });

      if (!existingReward) {
        await this.connection
          .collection('users')
          .updateOne(
            { _id: new Types.ObjectId(payload.userId) },
            { $inc: { 'loyalty.point': this.REVIEW_REWARD_POINTS } },
          );

        await this.connection.collection('loyalty_histories').insertOne({
          user_id: new Types.ObjectId(payload.userId),
          order_id: new Types.ObjectId(payload.orderId),
          points: this.REVIEW_REWARD_POINTS,
          action: 'EARN',
          reason: `Thưởng điểm viết đánh giá sản phẩm (Review ID: ${payload.reviewId})`,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await this.notificationsService.createAndSend({
        recipient_role: 'CUSTOMER',
        recipient_id: payload.userId,
        title: 'Đánh giá của bạn đã được đăng!',
        message: existingReward
          ? `Đánh giá của bạn về sản phẩm đã được công khai. Cảm ơn bạn đã chia sẻ!`
          : `Đánh giá của bạn đã được công khai. Bạn nhận được ${this.REVIEW_REWARD_POINTS} điểm thưởng.`,
        type: NotificationType.LOYALTY,
        priority: NotificationPriority.LOW,
        metadata: {
          target_url: `/product/${payload.productId}#reviews`,
          review_id: payload.reviewId,
        },
      });

      this.logger.log(
        `[REVIEW EVENT] Đã xử lý đăng bài cho User ${payload.userId}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[REVIEW LỖI PUBLISH] User: ${payload.userId} - ${errorMessage}`,
      );
    }
  }

  // 2. VÁ LỖ HỔNG: THU HỒI ĐIỂM KHI BÀI BỊ XÓA/ẨN
  @OnEvent('review.deleted_or_hidden', { async: true })
  async handleReviewDeleted(payload: ReviewDeletedPayload) {
    try {
      // Tìm xem trước đó có được cộng điểm chưa
      const earnedHistory = await this.connection
        .collection('loyalty_histories')
        .findOne({
          user_id: new Types.ObjectId(payload.userId),
          order_id: new Types.ObjectId(payload.orderId),
          action: 'EARN',
          reason: { $regex: payload.reviewId },
        });

      // Nếu trước đó đã cộng tiền, giờ phải trừ đi
      if (earnedHistory) {
        await this.connection.collection('users').updateOne(
          { _id: new Types.ObjectId(payload.userId) },
          { $inc: { 'loyalty.point': -this.REVIEW_REWARD_POINTS } }, // Trừ điểm
        );

        await this.connection.collection('loyalty_histories').insertOne({
          user_id: new Types.ObjectId(payload.userId),
          order_id: new Types.ObjectId(payload.orderId),
          points: -this.REVIEW_REWARD_POINTS,
          action: 'DEDUCT',
          reason: `Thu hồi điểm do đánh giá bị xóa hoặc vi phạm (Review ID: ${payload.reviewId})`,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        this.logger.warn(
          `[REVIEW EVENT] Đã thu hồi ${this.REVIEW_REWARD_POINTS} điểm của User ${payload.userId}`,
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[REVIEW LỖI DEDUCT] User: ${payload.userId} - ${errorMessage}`,
      );
    }
  }

  // 3. THÊM TÍNH NĂNG: THÔNG BÁO KHI ADMIN TRẢ LỜI
  @OnEvent('review.replied_by_admin', { async: true })
  async handleAdminReply(payload: ReviewRepliedPayload) {
    try {
      await this.notificationsService.createAndSend({
        recipient_role: 'CUSTOMER',
        recipient_id: payload.userId,
        title: 'Cửa hàng đã phản hồi đánh giá của bạn',
        message: `Quản trị viên vừa trả lời đánh giá của bạn: "${payload.replyContent.substring(0, 50)}..."`,
        type: NotificationType.ORDER, // Hoặc type SYSTEM tùy bạn
        priority: NotificationPriority.MEDIUM,
        metadata: {
          target_url: `/product/${payload.productId}#reviews`,
          review_id: payload.reviewId,
        },
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[REVIEW LỖI REPLY] User: ${payload.userId} - ${errorMessage}`,
      );
    }
  }
}
