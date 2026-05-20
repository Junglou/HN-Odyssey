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

  // AC1: Danh sách quản trị
  async getAdminList(query: AdminQueryReviewDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<Review> = {};

    // 1. Lọc theo trạng thái (Gom NEW và APPROVED)
    if (query.status) {
      if (query.status === ReviewStatus.NEW) {
        filter.status = { $in: [ReviewStatus.NEW, ReviewStatus.APPROVED] };
      } else {
        filter.status = query.status;
      }
    }

    // 2. Lọc theo số sao
    if (query.rating) filter.rating = Number(query.rating);

    // 3. FIX LỖI TÌM KIẾM CHÉO (Tên SP, Tên Khách, Nội dung)
    if (query.keyword) {
      const keywordRegex = { $regex: query.keyword, $options: 'i' }; // Không phân biệt hoa/thường

      // Tìm các Sản phẩm (Products) có Tên khớp với Keyword
      // Ép kiểu mảng trả về để ESLint hiểu rõ cấu trúc
      const matchingProducts = (await this.connection
        .collection('products')
        .find({ name: keywordRegex })
        .project({ _id: 1 })
        .toArray()) as Array<{ _id: Types.ObjectId }>;

      const productIds = matchingProducts.map((p) => p._id);

      // Tìm các Khách hàng (Customers) có Họ, Tên hoặc Email khớp với Keyword
      const matchingUsers = (await this.customerModel
        .find({
          $or: [
            { first_Name: keywordRegex },
            { last_Name: keywordRegex },
            { email: keywordRegex },
          ],
        })
        .select('_id')
        .lean()
        .exec()) as Array<{ _id: Types.ObjectId }>;

      const userIds = matchingUsers.map((u) => u._id);

      // Gom toàn bộ điều kiện: Tìm trong "Nội dung" HOẶC "Tên SP" HOẶC "Tên Khách"
      filter.$or = [
        { content: keywordRegex },
        { product_id: { $in: productIds } },
        { user_id: { $in: userIds } },
      ];
    }

    // 4. Thực thi truy vấn
    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .populate('user_id', 'first_Name last_Name email is_active')
        .populate('product_id', 'name price base_price') // Lấy Tên và Giá sản phẩm
        .sort({ is_pinned: -1, pinned_at: -1, createdAt: -1 }) // Ưu tiên bài ghim
        .skip(skip)
        .limit(limit)
        .lean()
        .exec() as unknown as Promise<Review[]>, // <--- FIX LỖI Ở ĐÂY: Ép kiểu an toàn báo cho ESLint biết
      this.reviewModel.countDocuments(filter),
    ]);

    return { items, meta: { total, page, limit } };
  }

  // AC3, AC4, AC5: Phản hồi & Khóa tài khoản (Gia cố bằng $set)
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

      // XỬ LÝ PHẢN HỒI (AC4)
      if (dto.reply_content && dto.reply_content.trim() !== '') {
        updateData.reply = {
          content: dto.reply_content.trim(),
          staff_id: new Types.ObjectId(adminId),
          replied_at: new Date(),
        };
        updateData.status = ReviewStatus.REPLIED;

        // Bắn sự kiện thông báo (Notification)
        this.eventEmitter.emit('review.replied_by_admin', {
          userId: review.user_id.toString(),
          reviewId: review._id.toString(),
          productId: review.product_id.toString(),
          replyContent: dto.reply_content.trim(),
        });
      }

      // XỬ LÝ KHÓA TÀI KHOẢN (AC5)
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

        // Cập nhật trạng thái khách hàng sang bị khóa
        await this.customerModel.updateOne(
          { _id: review.user_id },
          { $set: { is_active: false, lock_reason: reason } },
          { session },
        );

        // AC5: Tự động ẩn tất cả đánh giá của user này khỏi hệ thống công khai
        await this.reviewModel.updateMany(
          { user_id: review.user_id },
          { $set: { status: ReviewStatus.HIDDEN, is_pinned: false } },
          { session },
        );

        // Ghi Audit Log cho hành động khóa user
        await this.auditLogsService.log({
          action: Action.UPDATE,
          collection_name: Resource.CUSTOMERS,
          actor_id: adminId,
          department: Department.SUPPORT,
          target_id: String(review.user_id),
          detail: { reason, source_review: reviewId },
        });
      }

      // CẬP NHẬT REVIEW
      // Dùng updateOne + $set để Mongoose KHÔNG kiểm tra lại mảng media cũ
      if (Object.keys(updateData).length > 0) {
        await this.reviewModel.updateOne(
          { _id: reviewId },
          { $set: updateData as Record<string, unknown> },
          { session },
        );
      }

      await session.commitTransaction();
      return { success: true, message: 'Xử lý đánh giá thành công' };
    } catch (error: unknown) {
      // Nếu có bất kỳ lỗi nào, hủy bỏ mọi thay đổi trong DB
      await session.abortTransaction();
      throw error;
    } finally {
      // Kết thúc phiên làm việc với DB
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

    // Ép kiểu có thêm | null để an toàn
    const customer = review.user_id as unknown as {
      _id: Types.ObjectId;
      is_active?: boolean;
    } | null;

    // Chặn unhide nếu tài khoản bị khóa (chỉ check khi customer tồn tại)
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

      // FIX LỖI 500 TẠI ĐÂY: Dùng Optional Chaining (?.) và Fallback
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

  // Bổ sung vào AdminReviewsService.ts
  async updateInternalNote(reviewId: string, note: string) {
    const updatedReview = await this.reviewModel.findByIdAndUpdate(
      reviewId,
      { $set: { internal_note: note } }, // AC5: Lưu ghi chú riêng tư
      { new: true },
    );

    // FIX: Kiểm tra null trước khi trả về
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

    // LUỒNG 1: GỬI EMAIL KÈM MÃ GIẢM GIÁ (Trường hợp đền bù)
    if (dto.is_gift_included) {
      const config = dto.coupon_config;
      const randomStr = Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase();
      // Xử lý tên: Bỏ dấu tiếng Việt, bỏ ký tự đặc biệt, chỉ lấy A-Z
      let cleanName = 'VIP';
      if (customer.last_Name) {
        cleanName = customer.last_Name
          .normalize('NFD') // Tách dấu ra khỏi chữ cái
          .replace(/[\u0300-\u036f]/g, '') // Xóa các dấu vừa tách
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D')
          .replace(/[^a-zA-Z0-9]/g, '') // Chỉ giữ lại chữ cái và số, xóa khoảng trắng
          .substring(0, 3)
          .toUpperCase();
      }

      // Phòng trường hợp tên chứa toàn ký tự đặc biệt bị xóa sạch
      if (cleanName.length === 0) cleanName = 'VIP';

      giftCode = `HN-${cleanName}-${randomStr}`;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + (config?.days_valid || 30));

      // Tạo mã thật trong DB
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

      // Template có hiển thị khung Mã giảm giá
      htmlContent = this.generateEmailHtml(
        customer.first_Name || 'Quý khách',
        dto.content,
        { code: giftCode, discount: discountDisplay, expiry: endDate },
      );

      internalNoteStr = `Đã gửi email CSKH (Kèm mã đền bù: ${giftCode})`;
    }

    // LUỒNG 2: GỬI EMAIL THÔNG THƯỜNG (Mặc định)
    else {
      htmlContent = this.generateEmailHtml(
        customer.first_Name || 'Quý khách',
        dto.content,
        null,
      );
      internalNoteStr = 'Đã gửi email phản hồi cá nhân.';
    }

    // Gửi Email
    await this.emailService.sendRaw(
      customer.email,
      '[H&N Odyssey] Phản hồi đánh giá sản phẩm',
      htmlContent,
    );

    // Lưu nhật ký vào review
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

  // HÀM TẠO HTML DÙNG CHUNG CHO CẢ 2 LUỒNG
  private generateEmailHtml(
    name: string,
    content: string,
    gift: { code: string; discount: string; expiry: Date } | null,
  ): string {
    let giftSection = '';

    // Nếu có thông tin quà tặng mới vẽ khung đỏ
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
