import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { Order } from '../../sales/orders/schemas/order.schema';
import { Product } from '../catalog/schemas/product.schema';
import { AuditLogsService } from '../../system/audit-logs/audit-logs.service';
import {
  ReviewReport,
  ReviewReportDocument,
} from './schemas/review-report.schema';
import { ReportReviewDto } from './dto/report-review.dto';
import { Department } from 'src/common/enums/department.enum';
import { sanitizeReviewContent } from 'src/common/utils/xss-filter.util';
import { filterProfanity } from 'src/common/utils/profanity-filter.util';
import { UpdateReviewDto } from './dto/update-review.dto';
import { IReviewEditHistory } from 'src/common/interfaces/review.interface';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { ReviewQueryDto } from './dto/review-query.dto';

// 1. Interface Query Params
export interface ReviewQueryParam {
  page?: string | number;
  limit?: string | number;
  star?: string | number;
  has_media?: string;
  sort_by?: string;
  variant_sku?: string;
  [key: string]: unknown; // Dùng unknown thay cho any
}

// 2. Định nghĩa Type cho Aggregation Kết quả Rating
export interface RatingAggregationResult {
  _id: Types.ObjectId;
  avgRating: number;
  totalReviews: number;
}

// 3. Định nghĩa Type an toàn cho Aggregation Danh sách (Tránh lỗi Unsafe member access của ESLint)
export interface AggregatedUser {
  _id: Types.ObjectId;
  full_name: string;
  avatar: string | null;
}

export interface AggregatedReview {
  _id: Types.ObjectId;
  product_id: Types.ObjectId;
  user_id: Types.ObjectId | AggregatedUser;
  order_id: Types.ObjectId;
  variant_sku: string;
  rating: number;
  content: string;
  media: Record<string, unknown>[];
  is_anonymous: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  user?: AggregatedUser;
}

interface ReviewListAggregationResult {
  data: AggregatedReview[];
  totalCount: { count: number }[];
}

// 4. Định nghĩa Filter Type
interface ReviewFilter {
  product_id: Types.ObjectId;
  status: string;
  rating?: number;
  variant_sku?: string;
  media?: { $not: { $size: number } };
}

interface RatingStatResult {
  _id: number;
  count: number;
}

@Injectable()
export class ReviewsService {
  private readonly EDIT_TIME_LIMIT_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày

  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    private readonly auditLogsService: AuditLogsService,
    @InjectModel(ReviewReport.name)
    private reviewReportModel: Model<ReviewReportDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    userId: string,
    dto: CreateReviewDto,
    ip: string,
    userAgent: string,
  ) {
    const order = await this.orderModel
      .findOne({
        _id: dto.orderId,
        user_id: new Types.ObjectId(userId),
        status: { $in: ['COMPLETED', 'DELIVERED'] },
      })
      .lean();

    if (!order) {
      throw new ForbiddenException(
        'Bạn chưa mua sản phẩm này hoặc đơn hàng chưa hoàn tất giao dịch.',
      );
    }

    const itemExists = order.items.find(
      (item) =>
        item.product_id.toString() === dto.productId &&
        item.sku === dto.variantSku,
    );
    if (!itemExists) {
      throw new BadRequestException(
        'Sản phẩm không tồn tại trong đơn hàng này.',
      );
    }

    const existingReview = await this.reviewModel
      .findOne({
        order_id: new Types.ObjectId(dto.orderId),
        product_id: new Types.ObjectId(dto.productId),
        variant_sku: dto.variantSku,
      })
      .lean();

    if (existingReview) {
      throw new BadRequestException(
        'Bạn đã đánh giá sản phẩm này trong đơn hàng hiện tại rồi.',
      );
    }

    let safeContent = '';
    if (dto.content) {
      safeContent = sanitizeReviewContent(dto.content);
      const profanityCheck = filterProfanity(safeContent);
      if (!profanityCheck.isClean) {
        throw new BadRequestException(
          'Nội dung chứa từ ngữ không phù hợp, vui lòng chỉnh sửa lại.',
        );
      }
    }

    const review = await this.reviewModel.create({
      product_id: new Types.ObjectId(dto.productId),
      order_id: new Types.ObjectId(dto.orderId),
      variant_sku: dto.variantSku,
      user_id: new Types.ObjectId(userId),
      rating: dto.rating,
      content: safeContent,
      media: dto.media ? dto.media.map((m) => ({ ...m })) : [],
      is_anonymous: dto.is_anonymous || false,
      status: 'APPROVED',
    });

    await this.updateProductRating(dto.productId);

    this.eventEmitter.emit(NOTIFY_EVENTS.REVIEW_PUBLISHED, {
      userId,
      reviewId: review._id.toString(),
      productId: dto.productId,
      orderId: dto.orderId,
    });

    await this.auditLogsService.log({
      action: 'CREATE_REVIEW',
      collection_name: 'reviews',
      department: Department.SUPPORT,
      actor_id: userId,
      target_id: review._id.toString(),
      detail: { rating: dto.rating },
      ip,
      user_agent: userAgent,
    });

    return { message: 'Gửi đánh giá thành công', data: review };
  }

  async updateReviewByUser(
    userId: string,
    reviewId: string,
    dto: UpdateReviewDto,
    ip: string,
    userAgent: string,
  ) {
    const review = await this.reviewModel.findOne({
      _id: reviewId,
      user_id: new Types.ObjectId(userId),
    });

    if (!review)
      throw new NotFoundException(
        'Đánh giá không tồn tại hoặc không thuộc quyền sở hữu.',
      );

    const reviewCreatedAt = review.get('createdAt') as Date;
    const timeElapsed = Date.now() - reviewCreatedAt.getTime();
    if (timeElapsed > this.EDIT_TIME_LIMIT_MS) {
      throw new BadRequestException(
        'Đã quá thời hạn 7 ngày. Bạn không thể chỉnh sửa đánh giá này nữa.',
      );
    }

    const historyEntry: IReviewEditHistory = {
      old_rating: review.rating,
      old_content: review.content,
      edited_at: new Date(),
    };
    review.edit_history.push(historyEntry);

    if (dto.content !== undefined) {
      const safeContent = sanitizeReviewContent(dto.content);
      const profanityCheck = filterProfanity(safeContent);
      if (!profanityCheck.isClean) {
        throw new BadRequestException(
          'Nội dung chứa từ ngữ không phù hợp, vui lòng chỉnh sửa lại.',
        );
      }
      review.content = safeContent;
    }

    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.media !== undefined)
      review.media = dto.media as typeof review.media;

    await review.save();

    if (dto.rating !== undefined && dto.rating !== historyEntry.old_rating) {
      await this.updateProductRating(review.product_id.toString());
    }

    await this.auditLogsService.log({
      action: 'UPDATE_REVIEW',
      collection_name: 'reviews',
      department: Department.SUPPORT,
      actor_id: userId,
      target_id: review._id.toString(),
      detail: { edited: true },
      ip,
      user_agent: userAgent,
    });

    return { message: 'Cập nhật đánh giá thành công', data: review };
  }

  async deleteReviewByUser(
    userId: string,
    reviewId: string,
    ip: string,
    userAgent: string,
  ) {
    const review = await this.reviewModel.findOne({
      _id: reviewId,
      user_id: new Types.ObjectId(userId),
    });

    if (!review) throw new NotFoundException('Đánh giá không tồn tại.');

    const reviewCreatedAt = review.get('createdAt') as Date;
    const timeElapsed = Date.now() - reviewCreatedAt.getTime();
    if (timeElapsed > this.EDIT_TIME_LIMIT_MS) {
      throw new BadRequestException(
        'Đã quá hạn 7 ngày. Bạn không thể tự xóa đánh giá này.',
      );
    }

    await this.reviewModel.deleteOne({ _id: reviewId });
    await this.updateProductRating(review.product_id.toString());

    await this.auditLogsService.log({
      action: 'DELETE_REVIEW',
      collection_name: 'reviews',
      actor_id: userId,
      target_id: reviewId,
      department: Department.SUPPORT,
      ip,
      user_agent: userAgent,
    });

    return { message: 'Đã xóa đánh giá.' };
  }

  async replyReview(reviewId: string, staffId: string, dto: ReplyReviewDto) {
    const review = await this.reviewModel.findById(reviewId);
    if (!review) throw new NotFoundException('Đánh giá không tồn tại.');

    const safeReply = sanitizeReviewContent(dto.content);

    review.reply = {
      content: safeReply,
      staff_id: new Types.ObjectId(staffId),
      replied_at: new Date(),
    };

    await review.save();
    return { message: 'Đã phản hồi đánh giá', data: review };
  }

  async updateProductRating(productId: string): Promise<void> {
    const stats = await this.reviewModel.aggregate<RatingAggregationResult>([
      {
        $match: {
          product_id: new Types.ObjectId(productId),
          status: 'APPROVED',
        },
      },
      {
        $group: {
          _id: '$product_id',
          avgRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      const { avgRating, totalReviews } = stats[0];
      const safeAvg = avgRating || 0;

      await this.productModel.updateOne(
        { _id: productId },
        {
          rating_average: parseFloat(safeAvg.toFixed(1)),
          review_count: totalReviews,
        },
      );
    } else {
      await this.productModel.updateOne(
        { _id: productId },
        { rating_average: 0, review_count: 0 },
      );
    }
  }

  async findAll(productId: string, query: ReviewQueryDto) {
    const {
      page = 1,
      limit = 10,
      star,
      has_media,
      sort_by = 'newest',
      variant_sku,
    } = query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Type an toàn với Interface đã cấu hình
    const matchFilter: ReviewFilter = {
      product_id: new Types.ObjectId(productId),
      status: 'APPROVED',
    };

    if (star) matchFilter.rating = Number(star);
    if (variant_sku) matchFilter.variant_sku = String(variant_sku);
    if (has_media === 'true') {
      matchFilter.media = { $not: { $size: 0 } };
    }

    let sortStage: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort_by === 'oldest') sortStage = { createdAt: 1 };
    if (sort_by === 'highest_rating') sortStage = { rating: -1, createdAt: -1 };
    if (sort_by === 'lowest_rating') sortStage = { rating: 1, createdAt: -1 };
    if (sort_by === 'helpful') sortStage = { helpful_count: -1, createdAt: -1 };

    // Sử dụng Interface Generic cho hàm aggregate để trả ra Array đúng kiểu
    const [result] =
      await this.reviewModel.aggregate<ReviewListAggregationResult>([
        { $match: matchFilter },
        { $sort: sortStage },
        {
          $facet: {
            data: [
              { $skip: skip },
              { $limit: limitNumber },
              {
                $lookup: {
                  from: 'users',
                  localField: 'user_id',
                  foreignField: '_id',
                  as: 'user',
                  pipeline: [{ $project: { full_name: 1, avatar: 1 } }],
                },
              },
              { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            ],
            totalCount: [{ $count: 'count' }],
          },
        },
      ]);

    // Trích xuất an toàn với Optional Chaining
    const reviewsDocs = result?.data || [];
    const total = result?.totalCount?.[0]?.count || 0;

    // Đã gán type chuẩn, doc giờ đây có các thuộc tính gợi ý sẵn
    const finalReviews = reviewsDocs.map((doc: AggregatedReview) => {
      if (doc.is_anonymous && doc.user) {
        const nameParts = (doc.user.full_name || 'User').split(' ');
        const firstName = nameParts[0];
        const lastName =
          nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        doc.user.full_name = `${firstName[0]}*** ${lastName}`;
        doc.user.avatar = null;
      }
      return doc;
    });

    return {
      data: finalReviews,
      meta: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    };
  }

  async approveReview(
    reviewId: string,
    status: 'APPROVED' | 'HIDDEN',
    adminId: string,
    ip: string,
    userAgent: string,
  ) {
    const review = await this.reviewModel.findByIdAndUpdate(
      reviewId,
      { status },
      { new: true },
    );
    if (!review) throw new NotFoundException('Review không tồn tại');

    await this.updateProductRating(review.product_id.toString());

    await this.auditLogsService.log({
      action: 'APPROVE_REVIEW',
      collection_name: 'reviews',
      actor_id: adminId,
      target_id: review._id.toString(),
      department: Department.SUPPORT,
      detail: { new_status: status },
      ip,
      user_agent: userAgent,
    });

    return review;
  }

  async getPendingReviews() {
    return this.reviewModel.find({ status: 'PENDING' }).sort({ createdAt: 1 });
  }

  async reportReview(
    userId: string,
    reviewId: string,
    dto: ReportReviewDto,
    ip?: string,
    userAgent?: string,
  ) {
    const review = await this.reviewModel.findById(reviewId);
    if (!review) throw new NotFoundException('Đánh giá không tồn tại');

    const existingReport = await this.reviewReportModel.findOne({
      review_id: new Types.ObjectId(reviewId),
      reporter_id: new Types.ObjectId(userId),
    });

    if (existingReport) {
      throw new BadRequestException('Bạn đã báo cáo đánh giá này rồi.');
    }

    const report = await this.reviewReportModel.create({
      review_id: new Types.ObjectId(reviewId),
      reporter_id: new Types.ObjectId(userId),
      reason: dto.reason,
    });

    await this.auditLogsService.log({
      action: 'REPORT_REVIEW',
      collection_name: 'review_reports',
      department: Department.SUPPORT,
      actor_id: userId,
      target_id: report._id.toString(),
      detail: {
        review_id: reviewId,
        reason: dto.reason,
      },
      ip: ip || 'Unknown',
      user_agent: userAgent || 'Unknown',
    });

    return { message: 'Cảm ơn bạn đã báo cáo. Chúng tôi sẽ xem xét sớm nhất.' };
  }

  async voteHelpful(reviewId: string, userId: string) {
    const review = await this.reviewModel.findById(reviewId);
    if (!review) throw new NotFoundException('Review not found');

    const hasLiked = review.liked_by_users.includes(userId.toString());

    if (hasLiked) {
      await this.reviewModel.updateOne(
        { _id: reviewId },
        {
          $inc: { helpful_count: -1 },
          $pull: { liked_by_users: userId.toString() },
        },
      );
      return { message: 'Unvoted', current_count: review.helpful_count - 1 };
    } else {
      await this.reviewModel.updateOne(
        { _id: reviewId },
        {
          $inc: { helpful_count: 1 },
          $push: { liked_by_users: userId.toString() },
        },
      );
      return { message: 'Voted', current_count: review.helpful_count + 1 };
    }
  }

  async getStats(productId: string) {
    const objectId = new Types.ObjectId(productId);

    const stats = await this.reviewModel.aggregate<RatingStatResult>([
      {
        $match: {
          product_id: objectId,
          status: { $in: ['APPROVED', 'HIDDEN'] },
        },
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    const result: { [key: number]: number; total: number; average: number } = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
      total: 0,
      average: 0,
    };

    let totalRatingSum = 0;

    stats.forEach((item) => {
      result[item._id] = item.count;
      result.total += item.count;
      totalRatingSum += item._id * item.count;
    });

    if (result.total > 0) {
      result.average = parseFloat((totalRatingSum / result.total).toFixed(1));
    }

    const percentages = {
      5: result.total ? Math.round((result[5] / result.total) * 100) : 0,
      4: result.total ? Math.round((result[4] / result.total) * 100) : 0,
      3: result.total ? Math.round((result[3] / result.total) * 100) : 0,
      2: result.total ? Math.round((result[2] / result.total) * 100) : 0,
      1: result.total ? Math.round((result[1] / result.total) * 100) : 0,
    };

    return { stats: result, percentages };
  }
}
