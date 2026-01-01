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

  async create(userId: string, dto: CreateReviewDto) {
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
      // status: 'PENDING',
      status: 'APPROVED',
    });

    this.updateProductRating(dto.productId);

    return review;
  }

  async updateProductRating(productId: string) {
    const stats = await this.reviewModel.aggregate([
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
      const { avgRating, totalReviews, stars } = stats[0];
      await this.productModel.updateOne(
        { _id: productId },
        {
          rating_average: parseFloat(avgRating.toFixed(1)),
          review_count: totalReviews,
        },
      );
    }
  }

  async findAll(productId: string, query: any) {
    const {
      page = 1,
      limit = 10,
      star,
      has_media,
      sort_by = 'newest', // Mặc định là newest
      variant_sku,
    } = query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // 1. Xây dựng điều kiện lọc ($match)
    const matchFilter: any = {
      product_id: new Types.ObjectId(productId),
      status: 'APPROVED',
    };

    if (star) {
      matchFilter.rating = Number(star);
    }

    if (variant_sku) {
      matchFilter.variant_sku = variant_sku;
    }

    // Nếu user chỉ định lọc "Có hình ảnh"
    if (has_media === 'true') {
      matchFilter.media = { $not: { $size: 0 } };
    }

    // 2. Xây dựng logic sắp xếp ($sort)
    // AC15: Mặc định ưu tiên Media lên đầu, sau đó mới đến ngày tháng
    let sortStage: any = {};

    if (sort_by === 'helpful') {
      sortStage = { helpful_count: -1, createdAt: -1 };
    } else if (sort_by === 'oldest') {
      sortStage = { createdAt: 1 };
    } else {
      // Trường hợp 'newest' hoặc mặc định
      // Ưu tiên: Có Media (1) > Không Media (0) -> Sau đó mới đến ngày tạo mới nhất
      sortStage = { has_media_priority: -1, createdAt: -1 };
    }

    // 3. Thực thi Aggregation Pipeline
    const [result] = await this.reviewModel.aggregate([
      // B1: Lọc dữ liệu
      { $match: matchFilter },

      // B2: Tính toán trường ảo để phục vụ sắp xếp (AC15)
      // Nếu mảng media > 0 phần tử thì gán has_media_priority = 1, ngược lại = 0
      {
        $addFields: {
          has_media_priority: {
            $cond: { if: { $gt: [{ $size: '$media' }, 0] }, then: 1, else: 0 },
          },
        },
      },

      // B3: Sắp xếp
      { $sort: sortStage },

      // B4: Phân trang & Lấy tổng số (Dùng $facet để chạy song song)
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNumber },
            // Lookup để populate user info (Thay cho .populate)
            {
              $lookup: {
                from: 'users', // Tên collection User trong DB (thường là số nhiều)
                localField: 'user_id',
                foreignField: '_id',
                as: 'user',
                pipeline: [{ $project: { full_name: 1, avatar: 1 } }], // Chỉ lấy field cần thiết
              },
            },
            // Unwind mảng user (vì lookup trả về mảng)
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            // Map lại field user_id cho khớp format cũ nếu cần (Optional)
            { $addFields: { user_id: '$user' } },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ]);

    const reviewsDocs = result.data;
    const total = result.totalCount[0]?.count || 0;

    // 4. Mapping tên biến thể (Giữ nguyên logic cũ của bạn vì nó tối ưu)
    const product = await this.productModel
      .findById(productId)
      .select('variants')
      .lean();

    const variantMap = new Map<string, string>();
    if (product && product.variants) {
      product.variants.forEach((v) => {
        const variantName = v.attributes.map((attr) => attr.v).join(' / ');
        variantMap.set(v.sku, variantName);
      });
    }

    // 5. Format dữ liệu trả về
    const finalReviews = reviewsDocs.map((doc) => {
      // Vì dùng aggregate nên doc đã là Plain Object, không cần .toObject()
      // Xóa field tạm has_media_priority cho gọn response
      delete doc.has_media_priority;
      delete doc.user; // Đã map vào user_id ở step lookup

      if (doc.variant_sku) {
        doc.variant_name = variantMap.get(doc.variant_sku) || doc.variant_sku;
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

    this.updateProductRating(review.product_id.toString());

    //Ghi nhận hành động duyệt
    if (adminId) {
      await this.auditLogsService.log({
        action: 'APPROVE_REVIEW',
        collection_name: 'reviews',
        actor_id: adminId,
        target_id: review._id,
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

  async reportReview(userId: string, reviewId: string, dto: ReportReviewDto) {
    // 1. Kiểm tra Review có tồn tại không
    const review = await this.reviewModel.findById(reviewId);
    if (!review) throw new NotFoundException('Đánh giá không tồn tại');

    // 2. Kiểm tra xem user này đã report review này chưa (Tránh spam report)
    const existingReport = await this.reviewReportModel.findOne({
      review_id: new Types.ObjectId(reviewId),
      reporter_id: new Types.ObjectId(userId),
    });

    if (existingReport) {
      throw new BadRequestException('Bạn đã báo cáo đánh giá này rồi.');
    }

    // 3. Tạo báo cáo mới
    const report = await this.reviewReportModel.create({
      review_id: new Types.ObjectId(reviewId),
      reporter_id: new Types.ObjectId(userId),
      reason: dto.reason,
    });

    return { message: 'Cảm ơn bạn đã báo cáo. Chúng tôi sẽ xem xét sớm nhất.' };
  }

  async voteHelpful(reviewId: string, userId: string) {
    const review = await this.reviewModel.findById(reviewId);
    if (!review) throw new NotFoundException('Review not found');

    // Kiểm tra xem user đã like chưa
    const hasLiked = review.liked_by_users.includes(userId.toString());

    if (hasLiked) {
      // Unlike
      await this.reviewModel.updateOne(
        { _id: reviewId },
        {
          $inc: { helpful_count: -1 },
          $pull: { liked_by_users: userId.toString() },
        },
      );
      return { message: 'Unvoted', current_count: review.helpful_count - 1 };
    } else {
      // Like
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

    const stats = await this.reviewModel.aggregate([
      {
        $match: {
          product_id: objectId,
          status: { $in: ['APPROVED', 'HIDDEN'] },
        },
      },
      {
        $group: {
          _id: '$rating', // Group theo số sao (1, 2, 3, 4, 5)
          count: { $sum: 1 },
        },
      },
    ]);
    const result = {
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
