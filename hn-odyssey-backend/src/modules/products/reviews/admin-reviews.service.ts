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
import { EmailService } from 'src/modules/notifications/channels/email.service';
import { AdminSendEmailDto } from 'src/modules/users/customers/dto/admin-send-email.dto';
import { Coupon } from 'src/modules/marketing/promotions/schemas/coupon.schema';

interface IReviewUpdate {
  reply?: {
    content: string;
    staff_id: Types.ObjectId;
    replied_at: Date;
  };
  status?: ReviewStatus;
}

interface IRatingAggregationResult {
  _id: Types.ObjectId;
  avgRating: number;
  totalReviews: number;
}

@Injectable()
export class AdminReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly emailService: EmailService,
    @InjectModel('Coupon') private couponModel: Model<Coupon>,
  ) {}

  async getAdminList(query: AdminQueryReviewDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<Review> = {};

    if (query.status) {
      if (query.status === ReviewStatus.NEW) {
        filter.status = { $in: [ReviewStatus.NEW, ReviewStatus.APPROVED] };
      } else {
        filter.status = query.status;
      }
    }

    if (query.rating) filter.rating = Number(query.rating);

    if (query.keyword) {
      const keywordRegex = { $regex: query.keyword, $options: 'i' };

      const matchingProducts = (await this.connection
        .collection('products')
        .find({ name: keywordRegex })
        .project({ _id: 1 })
        .toArray()) as Array<{ _id: Types.ObjectId }>;

      const productIds = matchingProducts.map((p) => p._id);

      const matchingUsers = (await this.connection
        .collection('users')
        .find({
          $or: [
            { first_Name: keywordRegex },
            { last_Name: keywordRegex },
            { email: keywordRegex },
            {
              $expr: {
                $regexMatch: {
                  input: {
                    $concat: [
                      { $ifNull: ['$last_Name', ''] },
                      ' ',
                      { $ifNull: ['$first_Name', ''] },
                    ],
                  },
                  regex: query.keyword,
                  options: 'i',
                },
              },
            },
            {
              $expr: {
                $regexMatch: {
                  input: {
                    $concat: [
                      { $ifNull: ['$first_Name', ''] },
                      ' ',
                      { $ifNull: ['$last_Name', ''] },
                    ],
                  },
                  regex: query.keyword,
                  options: 'i',
                },
              },
            },
          ],
        })
        .project({ _id: 1 }) // Dùng .project thay cho .select vì đây là Native Driver
        .toArray()) as Array<{ _id: Types.ObjectId }>;

      const userIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { content: keywordRegex },
        { product_id: { $in: productIds } },
        { user_id: { $in: userIds } },
      ];
    }

    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .populate('user_id', 'first_Name last_Name email is_active')
        .populate('product_id', 'name price base_price')
        .sort({ is_pinned: -1, pinned_at: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec() as unknown as Promise<Review[]>,
      this.reviewModel.countDocuments(filter),
    ]);

    return { items, meta: { total, page, limit } };
  }

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

      const updateData: IReviewUpdate = {};
      let isReviewDeleted = false;

      if (dto.reply_content && dto.reply_content.trim() !== '') {
        updateData.reply = {
          content: dto.reply_content.trim(),
          staff_id: new Types.ObjectId(adminId),
          replied_at: new Date(),
        };
        updateData.status = ReviewStatus.REPLIED;

        this.eventEmitter.emit('review.replied_by_admin', {
          userId: review.user_id.toString(),
          reviewId: review._id.toString(),
          productId: review.product_id.toString(),
          replyContent: dto.reply_content.trim(),
        });
      }

      if (dto.block_customer) {
        const reason =
          dto.block_reason === BlockReason.OTHER
            ? dto.block_reason_other
            : dto.block_reason;

        if (!reason || reason.trim() === '') {
          throw new BadRequestException(
            'Vui lòng cung cấp chi tiết lý do vi phạm',
          );
        }

        const customer = await this.customerModel
          .findById(review.user_id)
          .session(session);

        await this.customerModel.updateOne(
          { _id: review.user_id },
          {
            $set: {
              review_access: 'RESTRICTED',
              status_reason: `Quản trị viên chặn quyền đánh giá. Lý do: ${reason}`,
            },
          },
          { session },
        );

        if (customer && customer.email) {
          try {
            const htmlBanContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
              <div style="background: #1a1a1a; color: #fff; padding: 20px; text-align: center;">
                <h2 style="margin: 0; letter-spacing: 2px;">H&N ODYSSEY</h2>
              </div>
              <div style="padding: 30px; line-height: 1.6; color: #333;">
                <p>Chào <b>${customer.first_Name || 'Quý khách'}</b>,</p>
                <p>Chúng tôi xin thông báo rằng tài khoản của bạn đã bị <b>hạn chế quyền đánh giá và bình luận</b> sản phẩm trên hệ thống H&N Odyssey.</p>
                <div style="background: #fffafa; border-left: 4px solid #d32f2f; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0 0 5px; font-weight: bold; color: #d32f2f;">Lý do vi phạm:</p>
                  <p style="margin: 0; font-style: italic;">${reason}</p>
                </div>
                <p>Bình luận vi phạm của bạn cũng đã được gỡ bỏ khỏi hệ thống.</p>
                <p>H&N Odyssey luôn đề cao môi trường mua sắm văn minh và tôn trọng lẫn nhau. Nếu bạn cho rằng đây là một sự nhầm lẫn, vui lòng liên hệ với bộ phận CSKH để được hỗ trợ kiểm tra lại.</p>
              </div>
              <div style="background: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                Trân trọng,<br/>H&N Odyssey Customer Support Team
              </div>
            </div>
            `;

            await this.emailService.sendRaw(
              customer.email,
              '[H&N Odyssey] Thông báo hạn chế quyền đánh giá sản phẩm',
              htmlBanContent,
            );
          } catch (emailError) {
            console.error(
              'Lỗi khi gửi email thông báo chặn review:',
              emailError,
            );
          }
        }

        await this.reviewModel.deleteOne({ _id: reviewId }, { session });
        isReviewDeleted = true;

        await this.auditLogsService.log({
          action: Action.UPDATE,
          collection_name: Resource.CUSTOMERS,
          actor_id: adminId,
          department: Department.SUPPORT,
          target_id: String(review.user_id),
          detail: {
            reason,
            source_review: reviewId,
            message: 'Đã xóa comment vi phạm và chặn quyền review',
          },
        });

        this.eventEmitter.emit('review.deleted_or_hidden', {
          userId: review.user_id.toString(),
          reviewId: review._id.toString(),
          orderId: review.order_id?.toString() || 'unknown_order',
          reason: 'ADMIN_DELETED',
        });
      }

      if (!isReviewDeleted && Object.keys(updateData).length > 0) {
        await this.reviewModel.updateOne(
          { _id: reviewId },
          { $set: updateData as Record<string, unknown> },
          { session },
        );
      }

      if (isReviewDeleted) {
        const productId = review.product_id;
        const stats = await this.reviewModel
          .aggregate<IRatingAggregationResult>([
            {
              $match: {
                product_id: productId,
                status: {
                  $in: [
                    ReviewStatus.NEW,
                    ReviewStatus.APPROVED,
                    ReviewStatus.REPLIED,
                  ],
                },
              },
            },
            {
              $group: {
                _id: '$product_id',
                avgRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
              },
            },
          ])
          .session(session);

        const avgRating =
          stats.length > 0
            ? parseFloat((stats[0].avgRating || 0).toFixed(1))
            : 0;
        const totalReviews = stats.length > 0 ? stats[0].totalReviews : 0;

        await this.connection
          .collection('products')
          .updateOne(
            { _id: productId },
            { $set: { rating_average: avgRating, review_count: totalReviews } },
            { session },
          );
      }

      await session.commitTransaction();
      return { success: true, message: 'Xử lý đánh giá thành công' };
    } catch (error: unknown) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async togglePin(reviewId: string) {
    const review = await this.reviewModel.findById(reviewId);
    if (!review || review.status === ReviewStatus.HIDDEN) {
      throw new BadRequestException('Không thể ghim đánh giá này');
    }
    review.is_pinned = !review.is_pinned;
    review.pinned_at = review.is_pinned ? new Date() : null;
    return review.save();
  }

  async toggleHideStatus(reviewId: string) {
    const review = await this.reviewModel
      .findById(reviewId)
      .populate<{ user_id: CustomerDocument }>('user_id');

    if (!review) throw new BadRequestException('Đánh giá không tồn tại');

    const customer = review.user_id as unknown as {
      _id: Types.ObjectId;
      is_active?: boolean;
    } | null;

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
      review.is_pinned = false;
      review.pinned_at = null;

      this.eventEmitter.emit('review.deleted_or_hidden', {
        userId: customer?._id?.toString() || 'unknown_user',
        reviewId: review._id.toString(),
        orderId: review.order_id?.toString() || 'unknown_order',
        reason: 'ADMIN_HIDDEN',
      });
    }

    await review.save();
    return { success: true, new_status: newStatus };
  }

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

  async updateInternalNote(reviewId: string, note: string) {
    const updatedReview = await this.reviewModel.findByIdAndUpdate(
      reviewId,
      { $set: { internal_note: note } },
      { new: true },
    );

    if (!updatedReview) {
      throw new BadRequestException(
        'Đánh giá không tồn tại để cập nhật ghi chú',
      );
    }

    return updatedReview;
  }

  async sendPrivateEmailResponse(reviewId: string, dto: AdminSendEmailDto) {
    const review = await this.reviewModel
      .findById(reviewId)
      .populate('user_id');
    if (!review || !review.user_id)
      throw new BadRequestException('Dữ liệu không hợp lệ');

    const customer = review.user_id as unknown as CustomerDocument;
    let htmlContent = '';
    let internalNoteStr = '';
    let giftCode: string | null = null;

    if (dto.is_gift_included) {
      const config = dto.coupon_config;
      const randomStr = Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase();
      let cleanName = 'VIP';
      if (customer.last_Name) {
        cleanName = customer.last_Name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D')
          .replace(/[^a-zA-Z0-9]/g, '')
          .substring(0, 3)
          .toUpperCase();
      }

      if (cleanName.length === 0) cleanName = 'VIP';

      giftCode = `HN-${cleanName}-${randomStr}`;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + (config?.days_valid || 30));

      await this.couponModel.create({
        code: giftCode,
        discount_type: config?.discount_type || 'FIXED',
        discount_value: config?.discount_value || 50000,
        min_order_value: config?.min_order_value || 0,
        start_date: new Date(),
        end_date: endDate,
        usage_limit: 1,
        is_active: true,
        owner_id: customer._id,
        description: `Quà tặng CSKH từ Review #${reviewId.slice(-6)}`,
      });

      const discountDisplay =
        config?.discount_type === 'PERCENTAGE'
          ? `${config.discount_value}%`
          : `${config?.discount_value?.toLocaleString()}đ`;

      htmlContent = this.generateEmailHtml(
        customer.first_Name || 'Quý khách',
        dto.content,
        { code: giftCode, discount: discountDisplay, expiry: endDate },
      );

      internalNoteStr = `Đã gửi email CSKH (Kèm mã đền bù: ${giftCode})`;
    } else {
      htmlContent = this.generateEmailHtml(
        customer.first_Name || 'Quý khách',
        dto.content,
        null,
      );
      internalNoteStr = 'Đã gửi email phản hồi cá nhân.';
    }

    await this.emailService.sendRaw(
      customer.email,
      '[H&N Odyssey] Phản hồi đánh giá sản phẩm',
      htmlContent,
    );

    await this.reviewModel.updateOne(
      { _id: reviewId },
      { $set: { internal_note: internalNoteStr } },
    );

    return {
      success: true,
      message: 'Đã gửi email thành công',
      coupon_code: giftCode,
    };
  }

  private generateEmailHtml(
    name: string,
    content: string,
    gift: { code: string; discount: string; expiry: Date } | null,
  ): string {
    let giftSection = '';

    if (gift) {
      giftSection = `
      <div style="background: #fffafa; border: 2px dashed #d32f2f; padding: 20px; text-align: center; margin-top: 30px;">
        <p style="margin: 0 0 10px; color: #666; font-size: 14px;">MÃ GIẢM GIÁ ĐỀN BÙ SỰ CỐ</p>
        <div style="font-size: 24px; font-weight: bold; color: #d32f2f; letter-spacing: 2px;">${gift.code}</div>
        <p style="margin: 5px 0 0; font-weight: bold;">Giảm: ${gift.discount}</p>
        <p style="margin: 5px 0 0; font-size: 12px; color: #888;">Hạn sử dụng: ${gift.expiry.toLocaleDateString('vi-VN')}</p>
      </div>
    `;
    }

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px;">
      <div style="background: #1a1a1a; color: #fff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; letter-spacing: 2px;">H&N ODYSSEY</h2>
      </div>
      <div style="padding: 30px; line-height: 1.6; color: #333;">
        <p>Chào <b>${name}</b>,</p>
        <p>H&N Odyssey đã nhận được đánh giá của bạn về đơn hàng vừa qua.</p>
        <div style="background: #f9f9f9; border-left: 4px solid #1a1a1a; padding: 15px; margin: 20px 0; font-style: italic;">
          "${content}"
        </div>
        ${giftSection}
      </div>
      <div style="background: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #888;">
        H&N Odyssey Customer Support Team
      </div>
    </div>
  `;
  }
}
