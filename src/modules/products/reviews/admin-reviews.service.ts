import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types, FilterQuery } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import {
  Customer,
  CustomerDocument,
} from 'src/modules/users/customers/schemas/customer.schema';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { Department } from 'src/common/enums/department.enum';
import { AdminConfirmActionDto } from './dto/admin-confirm-action.dto';
import { AdminQueryReviewDto } from './dto/admin-query-review.dto';
import { BulkActionDto } from './dto/bulk-action.dto';
import {
  BlockReason,
  ReviewStatus,
  BulkReviewAction,
} from 'src/common/enums/review.enum';

@Injectable()
export class AdminReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // AC1: Danh sách quản trị
  async getAdminList(query: AdminQueryReviewDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<Review> = {};
    if (query.status) filter.status = query.status;
    if (query.rating) filter.rating = Number(query.rating);

    if (query.keyword) {
      filter.content = { $regex: query.keyword, $options: 'i' };
    }

    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .populate('user_id', 'full_name email is_active')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.reviewModel.countDocuments(filter),
    ]);

    return { items, meta: { total, page, limit } };
  }

  // AC3, AC4, AC5: Phản hồi & Khóa tài khoản (Transaction)
  async confirmAction(
    reviewId: string,
    dto: AdminConfirmActionDto,
    adminId: string,
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const review = await this.reviewModel.findById(reviewId).session(session);
      if (!review) throw new BadRequestException('Đánh giá không tồn tại');

      // Phản hồi (AC4)
      if (dto.reply_content && dto.reply_content.trim() !== '') {
        review.reply = {
          content: dto.reply_content.trim(),
          staff_id: new Types.ObjectId(adminId),
          replied_at: new Date(),
        };
        review.status = ReviewStatus.REPLIED;

        this.eventEmitter.emit('review.replied_by_admin', {
          userId: review.user_id.toString(),
          reviewId: review._id.toString(),
          productId: review.product_id.toString(),
          replyContent: dto.reply_content.trim(),
        });
      }

      // Khóa Customer (AC5)
      if (dto.block_customer) {
        const reason =
          dto.block_reason === BlockReason.OTHER
            ? dto.block_reason_other
            : dto.block_reason;

        if (!reason || reason.trim() === '') {
          throw new BadRequestException(
            'Vui lòng cung cấp chi tiết lý do khóa tài khoản',
          );
        }

        await this.customerModel.updateOne(
          { _id: review.user_id },
          { $set: { is_active: false, lock_reason: reason } },
          { session },
        );

        // Ẩn tất cả đánh giá của user này
        await this.reviewModel.updateMany(
          { user_id: review.user_id },
          { $set: { status: ReviewStatus.HIDDEN, is_pinned: false } },
          { session },
        );

        // Ghi Audit Log
        await this.auditLogsService.log({
          action: Action.UPDATE,
          collection_name: Resource.CUSTOMERS,
          actor_id: adminId,
          department: Department.SUPPORT,
          target_id: String(review.user_id),
          detail: { reason },
        });
      }

      await review.save({ session });
      await session.commitTransaction();
      return { success: true };
    } catch (error: unknown) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  // AC8: Ghim đánh giá
  async togglePin(reviewId: string) {
    const review = await this.reviewModel.findById(reviewId);
    if (!review || review.status === ReviewStatus.HIDDEN) {
      throw new BadRequestException('Không thể ghim đánh giá này');
    }
    review.is_pinned = !review.is_pinned;
    review.pinned_at = review.is_pinned ? new Date() : null;
    return review.save();
  }

  // Xử lý AC2: Toggle nhanh và chặn nếu User bị Block
  async toggleHideStatus(reviewId: string) {
    const review = await this.reviewModel
      .findById(reviewId)
      .populate<{ user_id: CustomerDocument }>('user_id');
    if (!review) throw new BadRequestException('Đánh giá không tồn tại');
    const customer = review.user_id as unknown as {
      _id: Types.ObjectId;
      is_active?: boolean;
    };

    // Chặn unhide nếu tài khoản bị khóa
    if (
      customer &&
      customer.is_active === false &&
      review.status === ReviewStatus.HIDDEN
    ) {
      throw new BadRequestException(
        'Khách hàng này đang bị khóa, không thể hiển thị đánh giá',
      );
    }

    const newStatus =
      review.status === ReviewStatus.HIDDEN
        ? review.reply?.content
          ? ReviewStatus.REPLIED
          : ReviewStatus.NEW
        : ReviewStatus.HIDDEN;

    review.status = newStatus;

    if (newStatus === ReviewStatus.HIDDEN) {
      review.is_pinned = false; // Auto unpin
      review.pinned_at = null;

      this.eventEmitter.emit('review.deleted_or_hidden', {
        userId: customer._id.toString(),
        reviewId: review._id.toString(),
        orderId: review.order_id.toString(),
        reason: 'ADMIN_HIDDEN',
      });
    }

    await review.save();
    return { success: true, new_status: newStatus };
  }

  // Xử lý AC6: Thao tác hàng loạt
  async bulkActions(dto: BulkActionDto, adminId: string) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const objectIds = dto.review_ids.map(
        (id: string) => new Types.ObjectId(id),
      );

      switch (dto.action) {
        case BulkReviewAction.HIDE: {
          await this.reviewModel.updateMany(
            { _id: { $in: objectIds } },
            { $set: { status: ReviewStatus.HIDDEN, is_pinned: false } },
            { session },
          );
          break;
        }

        case BulkReviewAction.UNHIDE: {
          // AC2 rule: Không unhide bài của user bị block
          const blockedUsers = await this.customerModel
            .find({ is_active: false } as FilterQuery<CustomerDocument>)
            .select('_id')
            .lean()
            .exec();

          const blockedIds = blockedUsers.map((u) => u._id);

          await this.reviewModel.updateMany(
            { _id: { $in: objectIds }, user_id: { $nin: blockedIds } },
            { $set: { status: ReviewStatus.NEW } },
            { session },
          );
          break;
        }

        case BulkReviewAction.DELETE: {
          await this.reviewModel.deleteMany(
            { _id: { $in: objectIds } },
            { session },
          );
          await this.auditLogsService.log({
            action: Action.DELETE,
            collection_name: Resource.REVIEWS,
            actor_id: adminId,
            department: Department.SUPPORT,
            detail: { deleted_ids: dto.review_ids },
          });
          break;
        }
      }
      await session.commitTransaction();
      return { success: true };
    } catch (error: unknown) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
