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

// 1. Interface cho Query Params
export interface ReviewQueryParam {
  page?: string | number;
  limit?: string | number;
  star?: string | number;
  has_media?: string; // 'true' | 'false'
  sort_by?: string;
  variant_sku?: string;
  [key: string]: any;
}

// 2. Interface cho kết quả Aggregation tính điểm trung bình
interface RatingAggregationResult {
  _id: Types.ObjectId;
  avgRating: number;
  totalReviews: number;
}

// 3. Interface cho kết quả Aggregation findAll
interface ReviewListAggregationResult {
  data: (ReviewDocument & { user?: any; variant_name?: string })[];
  totalCount: { count: number }[];
}

// 4. Interface cho kết quả Aggregation thống kê
interface RatingStatResult {
  _id: number; // 1, 2, 3, 4, 5
  count: number;
}

// 5. Interface phụ trợ cho Variant
interface VariantAttribute {
  code: string;
  value: string;
}
interface ProductVariantLean {
  sku: string;
  attributes: VariantAttribute[];
}

interface ReviewFilter {
  product_id: Types.ObjectId;
  status: string;
  rating?: number;
  variant_sku?: string;
  media?: { $not: { $size: number } };
  [key: string]: any;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    private readonly auditLogsService: AuditLogsService,
    @InjectModel(ReviewReport.name)
    private reviewReportModel: Model<ReviewReportDocument>,
  ) {}

  async create(
    userId: string,
    dto: CreateReviewDto,
    ip?: string,
    userAgent?: string,
  ) {
    const order = await this.orderModel.findOne({
      _id: dto.orderId,
      user_id: new Types.ObjectId(userId),
      status: 'COMPLETED',
    });

    if (!order) {
      throw new ForbiddenException(
        'Bạn chưa mua sản phẩm này hoặc đơn hàng chưa hoàn tất',
      );
    }

    const itemExists = order.items.find(
      (item) =>
        item.product_id.toString() === dto.productId &&
        item.sku === dto.variantSku,
    );

    if (!itemExists) {
      throw new BadRequestException(
        'Sản phẩm không tồn tại trong đơn hàng này',
      );
    }

    const existingReview = await this.reviewModel.findOne({
      order_id: new Types.ObjectId(dto.orderId),
      product_id: new Types.ObjectId(dto.productId),
      variant_sku: dto.variantSku,
    });

    if (existingReview) {
      throw new BadRequestException('Bạn đã đánh giá sản phẩm này rồi');
    }

    const review = await this.reviewModel.create({
      product_id: new Types.ObjectId(dto.productId),
      order_id: new Types.ObjectId(dto.orderId),
      variant_sku: dto.variantSku,
      user_id: new Types.ObjectId(userId),
      rating: dto.rating,
      content: dto.content,
      media: dto.media,
      status: 'APPROVED',
    });

    // Thêm await để tránh floating promises
    await this.updateProductRating(dto.productId);

    await this.auditLogsService.log({
      action: 'CREATE_REVIEW',
      collection_name: 'reviews',
      department: Department.SUPPORT,
      actor_id: userId,
      target_id: review._id,
      detail: {
        product_id: dto.productId,
        rating: dto.rating,
        has_media: dto.media && dto.media.length > 0,
      },
      ip: ip || 'Unknown',
      user_agent: userAgent || 'Unknown',
    });

    return review;
  }

  async updateProductRating(productId: string) {
    // Ép kiểu kết quả aggregation về RatingAggregationResult[]
    const stats = await this.reviewModel.aggregate<RatingAggregationResult>([
      {
        $match: {
          product_id: new Types.ObjectId(productId),
          status: { $in: ['APPROVED', 'HIDDEN'] },
        },
      },
      {
        $group: {
          _id: '$product_id',
          avgRating: {
            $avg: {
              $cond: [{ $eq: ['$status', 'APPROVED'] }, '$rating', null],
            },
          },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      // Xóa biến 'stars' thừa, truy cập an toàn nhờ Interface
      const { avgRating, totalReviews } = stats[0];

      // avgRating có thể là null nếu chưa có review approved nào
      const safeAvg = avgRating || 0;

      await this.productModel.updateOne(
        { _id: productId },
        {
          rating_average: parseFloat(safeAvg.toFixed(1)),
          review_count: totalReviews,
        },
      );
    }
  }

  // Sử dụng Interface ReviewQueryParam thay vì any
  async findAll(productId: string, query: ReviewQueryParam) {
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

    // Sử dụng Interface ReviewFilter thay vì any
    const matchFilter: ReviewFilter = {
      product_id: new Types.ObjectId(productId),
      status: 'APPROVED',
    };

    if (star) {
      matchFilter.rating = Number(star);
    }

    if (variant_sku) {
      matchFilter.variant_sku = variant_sku;
    }

    if (has_media === 'true') {
      matchFilter.media = { $not: { $size: 0 } };
    }

    let sortStage: Record<string, 1 | -1> = {};

    if (sort_by === 'helpful') {
      sortStage = { helpful_count: -1, createdAt: -1 };
    } else if (sort_by === 'oldest') {
      sortStage = { createdAt: 1 };
    } else {
      sortStage = { has_media_priority: -1, createdAt: -1 };
    }

    const [result] =
      await this.reviewModel.aggregate<ReviewListAggregationResult>([
        { $match: matchFilter },
        {
          $addFields: {
            has_media_priority: {
              $cond: {
                if: { $gt: [{ $size: '$media' }, 0] },
                then: 1,
                else: 0,
              },
            },
          },
        },
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
              { $addFields: { user_id: '$user' } },
            ],
            totalCount: [{ $count: 'count' }],
          },
        },
      ]);

    const reviewsDocs = result.data;
    const total = result.totalCount[0]?.count || 0;

    const product = await this.productModel
      .findById(productId)
      .select('variants')
      .lean();

    const variantMap = new Map<string, string>();

    if (product && product.variants) {
      const variants = product.variants as unknown as ProductVariantLean[];
      variants.forEach((v) => {
        if (v.attributes) {
          const variantName = v.attributes
            .map((attr) => attr.value)
            .join(' / ');
          variantMap.set(v.sku, variantName);
        }
      });
    }

    // Định nghĩa kiểu cho docObj để tránh lỗi unsafe member access/return
    const finalReviews = reviewsDocs.map((doc) => {
      // Ép kiểu về object có các thuộc tính mở rộng
      const docObj = doc as ReviewDocument & {
        variant_name?: string;
        has_media_priority?: number;
        user?: any;
      };

      // Xóa thuộc tính an toàn
      delete docObj.has_media_priority;
      delete docObj.user;

      if (doc.variant_sku) {
        docObj.variant_name =
          variantMap.get(doc.variant_sku) || doc.variant_sku;
      }
      return docObj;
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
    adminId?: string,
    ip?: string,
    userAgent?: string,
  ) {
    const review = await this.reviewModel.findByIdAndUpdate(
      reviewId,
      { status },
      { new: true },
    );
    if (!review) throw new NotFoundException('Review not found');

    // Thêm await
    await this.updateProductRating(review.product_id.toString());

    if (adminId) {
      await this.auditLogsService.log({
        action: 'APPROVE_REVIEW',
        collection_name: 'reviews',
        actor_id: adminId,
        target_id: review._id,
        department: Department.SUPPORT,
        detail: { new_status: status },
        ip: ip || 'Unknown',
        user_agent: userAgent || 'Unknown',
      });
    }

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
      target_id: report._id,
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

    // Ép kiểu aggregation stats về RatingStatResult[]
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

    // Định nghĩa kiểu rõ ràng cho result object
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
      // item._id giờ đã có kiểu number
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
