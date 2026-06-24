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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ReviewStatus } from 'src/common/enums/review.enum';
import { User, UserDocument } from 'src/modules/users/schemas/user.schema';
import {
  Customer,
  CustomerDocument,
} from 'src/modules/users/customers/schemas/customer.schema';

// Khai báo Interface cho DTO Reply để fix triệt để lỗi "any" của ESLint
export interface ICustomerReplyDto {
  content: string;
  media?: Array<{
    url: string;
    type: 'IMAGE' | 'VIDEO';
    thumbnail?: string;
  }>;
}

export interface ICustomerReplyResult {
  _id: Types.ObjectId;
  user_id: Types.ObjectId | AggregatedUser;
  content: string;
  media: Record<string, unknown>[];
  createdAt: Date;
  user?: AggregatedUser;
}

// 1. Interface Query Params
export interface ReviewQueryParam {
  page?: string | number;
  limit?: string | number;
  star?: string | number;
  has_media?: string;
  sort_by?: string;
  variant_sku?: string;
  [key: string]: unknown;
}

// 2. Định nghĩa Type cho Aggregation Kết quả Rating
export interface RatingAggregationResult {
  _id: Types.ObjectId;
  avgRating: number;
  totalReviews: number;
}

// 3. Định nghĩa Type an toàn cho Aggregation Danh sách
export interface AggregatedUser {
  _id: Types.ObjectId;
  first_Name?: string;
  last_Name?: string;
  full_name?: string;
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
  status: string | ReviewStatus | { $in: ReviewStatus[] };
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
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>, // Đã sửa lỗi typo "customermodel"
  ) {}

  // Hàm tự động nhận diện và chuyển đổi Slug thành ObjectId chuẩn
  private async resolveProductId(identifier: string): Promise<string> {
    if (Types.ObjectId.isValid(identifier)) {
      return identifier;
    }
    const product = await this.productModel
      .findOne({ slug: identifier })
      .select('_id')
      .lean();

    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }
    return product._id.toString();
  }

  async create(userId: string, dto: CreateReviewDto) {
    const user = (await this.userModel
      .findById(userId)
      .select('review_access')
      .lean()) as { review_access?: string } | null;

    if (user && user.review_access === 'RESTRICTED') {
      throw new ForbiddenException(
        'Tài khoản của bạn đã bị hạn chế quyền đánh giá.',
      );
    }
    const order = await this.orderModel
      .findOne({
        _id: dto.orderId,
        user_id: new Types.ObjectId(userId),
        status: { $in: ['COMPLETED', 'DELIVERED'] },
      })
      .lean();

    if (!order) {
      throw new ForbiddenException(
        'Bạn chưa mua sản phẩm này hoặc đơn hàng chưa hoàn tất.',
      );
    }

    const actualProductId = await this.resolveProductId(dto.productId);
    const itemExists = order.items.find(
      (item) =>
        item.product_id.toString() === actualProductId &&
        item.sku === dto.variantSku,
    );
    if (!itemExists) {
      throw new BadRequestException(
        'Sản phẩm không tồn tại trong đơn hàng này.',
      );
    }

    let safeContent = '';
    if (dto.content) {
      safeContent = sanitizeReviewContent(dto.content);
      const profanityCheck = filterProfanity(safeContent);
      if (!profanityCheck.isClean && profanityCheck.filteredText) {
        safeContent = profanityCheck.filteredText;
      }
    }

    const review = await this.reviewModel.create({
      product_id: new Types.ObjectId(actualProductId),
      order_id: new Types.ObjectId(dto.orderId),
      variant_sku: dto.variantSku,
      user_id: new Types.ObjectId(userId),
      rating: dto.rating,
      content: safeContent,
      media: dto.media ? dto.media.map((m) => ({ ...m })) : [],
      is_anonymous: dto.is_anonymous || false,
      status: ReviewStatus.NEW,
    });

    await this.updateProductRating(actualProductId);

    this.eventEmitter.emit(NOTIFY_EVENTS.REVIEW_PUBLISHED, {
      userId,
      reviewId: review._id.toString(),
      productId: dto.productId,
      orderId: dto.orderId,
      rating: dto.rating,
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
      let safeContent = sanitizeReviewContent(dto.content);

      // Auto-Moderation (AC7): Xử lý che từ cấm khi update
      const profanityCheck = filterProfanity(safeContent);
      if (!profanityCheck.isClean && profanityCheck.filteredText) {
        safeContent = profanityCheck.filteredText;
      }

      review.content = safeContent;
    }

    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.media !== undefined)
      review.media = dto.media as typeof review.media;

    await review.save();

    if (dto.rating !== undefined && dto.rating !== historyEntry.old_rating) {
      await this.updateProductRating(review.product_id.toString());

      // Gửi tín hiệu để đồng bộ dữ liệu điểm số mới cho hệ thống máy học
      this.eventEmitter.emit('review.updated', {
        userId: userId,
        reviewId: reviewId,
        rating: dto.rating,
      });
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

    this.eventEmitter.emit('review.deleted_or_hidden', {
      userId: userId,
      reviewId: reviewId,
      orderId: review.order_id.toString(),
      reason: 'USER_DELETED',
    });

    return { message: 'Đã xóa đánh giá.' };
  }

  async updateProductRating(productId: string): Promise<void> {
    const stats = await this.reviewModel.aggregate<RatingAggregationResult>([
      {
        $match: {
          product_id: new Types.ObjectId(productId),
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
    const actualProductId = await this.resolveProductId(productId);
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
    const matchFilter: ReviewFilter = {
      product_id: new Types.ObjectId(actualProductId),
      status: {
        $in: [ReviewStatus.NEW, ReviewStatus.APPROVED, ReviewStatus.REPLIED],
      },
    };

    if (star) matchFilter.rating = Number(star);
    if (variant_sku) matchFilter.variant_sku = String(variant_sku);
    if (has_media === 'true') {
      matchFilter.media = { $not: { $size: 0 } };
    }

    let sortStage: Record<string, 1 | -1> = { createdAt: -1 };
    // Luôn ưu tiên Ghim lên đầu tiên theo đúng AC8
    if (sort_by === 'newest')
      sortStage = { is_pinned: -1, pinned_at: -1, createdAt: -1 };
    if (sort_by === 'oldest')
      sortStage = { is_pinned: -1, pinned_at: -1, createdAt: 1 };
    if (sort_by === 'highest_rating')
      sortStage = { is_pinned: -1, pinned_at: -1, rating: -1, createdAt: -1 };
    if (sort_by === 'lowest_rating')
      sortStage = { is_pinned: -1, pinned_at: -1, rating: 1, createdAt: -1 };
    if (sort_by === 'helpful')
      sortStage = {
        is_pinned: -1,
        pinned_at: -1,
        helpful_count: -1,
        createdAt: -1,
      };

    const [result] =
      await this.reviewModel.aggregate<ReviewListAggregationResult>([
        { $match: matchFilter },
        { $sort: sortStage },
        {
          $facet: {
            data: [
              {
                $lookup: {
                  from: 'users',
                  localField: 'customer_replies.user_id',
                  foreignField: '_id',
                  as: 'reply_users',
                  pipeline: [
                    { $project: { first_Name: 1, last_Name: 1, avatar: 1 } },
                  ],
                },
              },
              { $skip: skip },
              { $limit: limitNumber },
              {
                $lookup: {
                  from: 'users',
                  localField: 'user_id',
                  foreignField: '_id',
                  as: 'user',
                  pipeline: [
                    { $project: { first_Name: 1, last_Name: 1, avatar: 1 } },
                  ],
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

    const finalReviews = reviewsDocs.map((doc: AggregatedReview) => {
      if (doc.user) {
        const firstName = doc.user.first_Name || 'User';
        const lastName = doc.user.last_Name || '';

        if (doc.is_anonymous) {
          // Khách hàng chọn ẩn danh -> Che tên thành "V*** Hùng"
          doc.user.full_name = `${firstName.charAt(0)}*** ${lastName}`;
          doc.user.avatar = null;
        } else {
          // Ghép tên đầy đủ để FE client sử dụng
          doc.user.full_name = `${firstName} ${lastName}`.trim();
        }
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

  async reportReview(
    userId: string,
    reviewId: string,
    dto: ReportReviewDto,
    ip?: string,
    userAgent?: string,
  ) {
    const review = await this.reviewModel.findById(reviewId);
    if (!review) throw new NotFoundException('Đánh giá không tồn tại');

    // Tạo record report (Lưu vết)
    await this.reviewReportModel.create({
      review_id: new Types.ObjectId(reviewId),
      reporter_id: new Types.ObjectId(userId),
      reason: dto.reason,
    });

    // AUTO ACTION: Xóa comment
    await this.reviewModel.deleteOne({ _id: reviewId });
    await this.updateProductRating(review.product_id.toString());

    // AUTO ACTION: Tắt quyền review của tác giả comment
    await this.customerModel.updateOne(
      { _id: review.user_id },
      {
        $set: {
          review_access: 'RESTRICTED',
          status_reason: `Hệ thống tự động khóa do vi phạm (Report bởi User ${userId})`,
        },
      },
    );

    await this.auditLogsService.log({
      action: 'AUTO_RESOLVE_REPORT',
      collection_name: 'reviews',
      department: Department.SUPPORT,
      actor_id: userId,
      target_id: reviewId,
      detail: { message: 'Xóa tự động và chặn người dùng', reason: dto.reason },
      ip: ip || 'Unknown',
      user_agent: userAgent || 'Unknown',
    });

    return {
      message: 'Đã xử lý báo cáo vi phạm thành công. Bình luận đã được gỡ bỏ.',
    };
  }

  // 4. THÊM HÀM XỬ LÝ CUSTOMER REPLY
  async replyToReview(
    userId: string,
    reviewId: string,
    dto: ICustomerReplyDto, // Đã fix từ any sang Interface
  ) {
    const user = (await this.userModel
      .findById(userId)
      .select('review_access')
      .lean()) as { review_access?: string } | null;
    if (user && user.review_access === 'RESTRICTED') {
      throw new ForbiddenException('Tài khoản của bạn đã bị hạn chế.');
    }

    const review = await this.reviewModel.findById(reviewId);
    if (!review) throw new NotFoundException('Đánh giá không tồn tại');

    let safeContent = sanitizeReviewContent(dto.content);
    const profanityCheck = filterProfanity(safeContent);
    if (!profanityCheck.isClean && profanityCheck.filteredText) {
      safeContent = profanityCheck.filteredText;
    }

    // Mapping an toàn, loại bỏ triệt để lỗi "unsafe-assignment"
    const mappedMedia = dto.media
      ? dto.media.map((m) => ({
          url: m.url,
          type: m.type,
          thumbnail: m.thumbnail,
        }))
      : [];

    const newReply = {
      user_id: new Types.ObjectId(userId),
      content: safeContent,
      media: mappedMedia,
      createdAt: new Date(),
    };

    await this.reviewModel.updateOne(
      { _id: reviewId },
      { $push: { customer_replies: newReply } },
    );

    return { message: 'Phản hồi thành công', data: newReply };
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
    const actualProductId = await this.resolveProductId(productId);
    const objectId = new Types.ObjectId(actualProductId);

    const stats = await this.reviewModel.aggregate<RatingStatResult>([
      {
        $match: {
          product_id: objectId,
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

  async checkEligibility(userId: string, productId: string) {
    const actualProductId = await this.resolveProductId(productId);

    const eligibleOrders = await this.orderModel
      .find({
        user_id: new Types.ObjectId(userId),
        status: { $in: ['COMPLETED', 'DELIVERED'] },
        'items.product_id': new Types.ObjectId(actualProductId),
      })
      .lean();

    if (!eligibleOrders || eligibleOrders.length === 0) {
      return {
        isEligible: false,
        message: 'Chưa mua hàng hoặc đơn hàng chưa hoàn thành',
      };
    }

    // Lấy order gần nhất hợp lệ để gắn ID
    const latestOrder = eligibleOrders[0];
    const item = latestOrder.items.find(
      (i) => i.product_id.toString() === actualProductId,
    );

    return {
      isEligible: true,
      orderId: latestOrder._id.toString(),
      variantSku: item?.sku || '',
    };
  }
}
