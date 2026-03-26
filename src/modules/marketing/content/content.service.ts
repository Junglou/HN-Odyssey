import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types, AnyBulkWriteOperation } from 'mongoose';
import { Banner, BannerStatus } from './schemas/banner.schema';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { ReorderBannersDto } from './dto/reorder-banner.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

// Định nghĩa Interface cho Query để hết báo lỗi 'any'
export interface QueryBannerDto {
  page?: number | string;
  limit?: number | string;
  position?: string;
  status?: BannerStatus;
}

@Injectable()
export class ContentService {
  constructor(@InjectModel(Banner.name) private bannerModel: Model<Banner>) {}

  async createBanner(dto: CreateBannerDto) {
    const start = new Date(dto.start_date);
    const end = new Date(dto.end_date);
    const now = new Date();

    const newBanner = new this.bannerModel({
      ...dto,
      status:
        start <= now && now <= end ? BannerStatus.ACTIVE : BannerStatus.WAITING,
    });

    return newBanner.save();
  }

  // AC6: Vô hiệu hóa / Xóa mềm banner
  async softDeleteBanner(id: string) {
    const banner = await this.bannerModel.findById(id);
    if (!banner || banner.is_deleted) {
      throw new NotFoundException('Không tìm thấy Banner');
    }

    banner.is_deleted = true;
    banner.deleted_at = new Date();
    banner.status = BannerStatus.HIDDEN;
    await banner.save();

    return { message: 'Đã xóa mềm banner thành công' };
  }

  // AC8: Ghi nhận lượt nhấp (Click Tracking an toàn)
  async trackClick(id: string) {
    // Kiểm tra tính hợp lệ của ID (tránh lỗi CastError)
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID Banner không hợp lệ');
    }

    // Kiểm tra banner có tồn tại không trước khi update (tiết kiệm payload)
    const banner = await this.bannerModel
      .findOne({ _id: id, is_deleted: false })
      .select('_id');
    if (!banner) {
      throw new NotFoundException('Banner không tồn tại hoặc đã bị xóa');
    }

    await this.bannerModel.updateOne({ _id: id }, { $inc: { clicks: 1 } });
    return { success: true };
  }

  // Lấy danh sách Banner cho Admin (Phân trang, lọc)
  async findAll(query: QueryBannerDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    // Định nghĩa kiểu FilterQuery
    const filter: FilterQuery<Banner> = { is_deleted: false };

    if (query.position) filter.position = query.position;
    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
      this.bannerModel
        .find(filter)
        .sort({ display_order: 1, created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.bannerModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        totalItems: total,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  // Lấy chi tiết Banner (Admin)
  async findOne(id: string) {
    const banner = await this.bannerModel
      .findOne({ _id: id, is_deleted: false })
      .lean();
    if (!banner) throw new NotFoundException('Không tìm thấy Banner');
    return banner;
  }

  // Cập nhật Banner (Admin)
  async updateBanner(id: string, dto: UpdateBannerDto) {
    const banner = await this.bannerModel.findOne({
      _id: id,
      is_deleted: false,
    });
    if (!banner) throw new NotFoundException('Không tìm thấy Banner');

    Object.assign(banner, dto);

    // Check lại status nếu có sửa ngày tháng
    if (dto.start_date || dto.end_date) {
      const start = new Date(banner.start_date);
      const end = new Date(banner.end_date);
      const now = new Date();
      if (now >= start && now <= end) banner.status = BannerStatus.ACTIVE;
      else if (now < start) banner.status = BannerStatus.WAITING;
      else banner.status = BannerStatus.HIDDEN;
    }

    return banner.save();
  }

  // AC4: Cập nhật thứ tự hiển thị hàng loạt (Kéo thả trên Slider)
  async reorderBanners(dto: ReorderBannersDto) {
    // Khai báo chính xác Type mà Mongoose yêu cầu cho mảng bulkOps
    const bulkOps: AnyBulkWriteOperation<Banner>[] = dto.items.map((item) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(item.id) },
        update: { $set: { display_order: item.display_order } },
      },
    }));

    if (bulkOps.length > 0) {
      // Bây giờ thì truyền thẳng bulkOps vào, không cần "as any[]" nữa
      await this.bannerModel.bulkWrite(bulkOps);
    }
    return { message: 'Cập nhật thứ tự hiển thị thành công' };
  }

  // AC2, AC3, AC4: API Public lấy danh sách Banner hiển thị cho Frontend
  async getActiveBanners(position: string, categoryId?: string) {
    // Định nghĩa kiểu FilterQuery
    const filter: FilterQuery<Banner> = {
      status: BannerStatus.ACTIVE,
      is_deleted: false,
      position: position,
    };

    // Nếu truyền CategoryID (AC3: Gán banner theo ngữ cảnh danh mục)
    if (categoryId) {
      filter.$or = [
        // Convert string sang ObjectId
        { category_id: new Types.ObjectId(categoryId) },
        { category_id: null }, // Lấy cả những banner dùng chung cho mọi danh mục
      ];
    }

    // AC8: Mỗi khi banner được fetch ra hiển thị, ta có thể tăng lượt Impression
    const banners = await this.bannerModel
      .find(filter)
      .sort({ display_order: 1, created_at: -1 }) // Sắp xếp theo index đã kéo thả
      .select('title link image_pc image_mobile position category_id') // Trả về vừa đủ dữ liệu cho client
      .lean();

    // Tăng Impression (Lượt hiển thị) ẩn danh dưới background
    if (banners.length > 0) {
      const bannerIds = banners.map((b) => b._id);

      // Dùng void và .catch để đánh dấu explicit floating promise, chặn ESLint báo lỗi
      void this.bannerModel
        .updateMany({ _id: { $in: bannerIds } }, { $inc: { impressions: 1 } })
        .exec()
        .catch((err) => console.error('Lỗi khi track impressions:', err));
    }

    return banners;
  }

  // AC2: Cron Job chạy mỗi phút để tự động đổi trạng thái hiển thị của Banner
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronBannerStatus() {
    const now = new Date();

    // Chờ hiển thị -> Đang hiển thị
    await this.bannerModel.updateMany(
      { status: BannerStatus.WAITING, start_date: { $lte: now } },
      { $set: { status: BannerStatus.ACTIVE } },
    );

    // Đang hiển thị -> Ẩn (Hết hạn)
    await this.bannerModel.updateMany(
      { status: BannerStatus.ACTIVE, end_date: { $lte: now } },
      { $set: { status: BannerStatus.HIDDEN } },
    );
  }
}
