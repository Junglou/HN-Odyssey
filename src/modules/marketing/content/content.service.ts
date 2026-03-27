import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types, AnyBulkWriteOperation } from 'mongoose';
import { Banner, BannerStatus } from './schemas/banner.schema';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { ReorderBannersDto } from './dto/reorder-banner.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

import { BlogPost, PostStatus } from './schemas/blog-post.schema';
import { StaticPage, PageStatus } from './schemas/static-page.schema'; // FIX: Thêm PageStatus
import { CreatePostDto } from './dto/create-post.dto';
import { CreateStaticPageDto } from './dto/create-static-page.dto'; // FIX: Thêm CreateStaticPageDto
import { MenuConfig } from './schemas/menu-config.schema';

import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';
import { Resource } from 'src/common/enums/resource.enum';
import {
  CreateMenuDto,
  UpdatePostDto,
  UpdateStaticPageDto,
} from './dto/update-content.dto';

export interface QueryBannerDto {
  page?: number | string;
  limit?: number | string;
  position?: string;
  status?: BannerStatus;
}

export interface QueryPostDto {
  page?: number | string;
  limit?: number | string;
  status?: PostStatus;
  category_id?: string;
  search?: string;
}

// FIX: Thêm QueryPageDto (dự phòng cho Static Page sau này)
export interface QueryPageDto {
  page?: number | string;
  limit?: number | string;
  status?: PageStatus;
}

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    @InjectModel(Banner.name) private bannerModel: Model<Banner>,
    @InjectModel(BlogPost.name) private postModel: Model<BlogPost>,
    @InjectModel(StaticPage.name) private pageModel: Model<StaticPage>,
    @InjectModel(MenuConfig.name) private menuModel: Model<MenuConfig>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // XỬ LÝ BLOG POSTS (US.125)

  private async checkSlugExist(
    slug: string,
    excludeId?: string | Types.ObjectId,
  ): Promise<void> {
    const filter: FilterQuery<BlogPost | StaticPage> = {
      slug,
      is_deleted: false,
    };
    if (excludeId) {
      if (!Types.ObjectId.isValid(excludeId)) {
        throw new BadRequestException('ID tham chiếu không hợp lệ');
      }
      filter._id = { $ne: new Types.ObjectId(String(excludeId)) };
    }

    const [postExists, pageExists] = await Promise.all([
      this.postModel.exists(filter),
      this.pageModel.exists(filter),
    ]);

    if (postExists || pageExists) {
      throw new BadRequestException(
        'Đường dẫn (Slug) đã tồn tại trên hệ thống, vui lòng chọn đường dẫn khác.',
      );
    }
  }

  async createPost(dto: CreatePostDto, userId: string, email: string) {
    await this.checkSlugExist(dto.slug);

    let initialStatus = dto.status || PostStatus.DRAFT;
    if (dto.published_at && new Date(dto.published_at) > new Date()) {
      initialStatus = PostStatus.SCHEDULED;
    }

    const newPost = new this.postModel({
      ...dto,
      status: initialStatus,
    });

    const savedPost = await newPost.save();

    await this.auditLogsService.log({
      action: 'CREATE',
      collection_name: Resource.BLOG,
      actor_id: userId,
      actor_email: email,
      target_id: savedPost._id, // FIX: Bỏ "as Types.ObjectId" vì _id mặc định đã là ObjectId
      department: Department.MARKETING,
      detail: { title: savedPost.title, slug: savedPost.slug },
    });

    return savedPost;
  }

  async findAllPosts(query: QueryPostDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const filter: FilterQuery<BlogPost> = { is_deleted: false };
    if (query.status) filter.status = query.status;
    if (query.category_id) {
      // FIX: Ép kiểu string sang chuỗi trước khi parse ObjectId (tránh lỗi unsafe-argument)
      filter.category_id = new Types.ObjectId(String(query.category_id));
    }
    if (query.search) {
      filter.title = { $regex: String(query.search), $options: 'i' };
    }

    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('embedded_product_ids', 'name price thumbnail')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.postModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        totalItems: total,
        itemsPerPage: limit,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async softDeletePost(id: string, userId: string, email: string) {
    const post = await this.postModel.findById(id);
    if (!post || post.is_deleted)
      throw new NotFoundException('Không tìm thấy bài viết');

    post.is_deleted = true;
    post.deleted_at = new Date();
    post.status = PostStatus.HIDDEN;
    await post.save();

    await this.auditLogsService.log({
      action: 'DELETE',
      collection_name: Resource.BLOG,
      actor_id: userId,
      actor_email: email,
      target_id: post._id, // FIX: Bỏ ép kiểu
      department: Department.MARKETING,
      detail: { reason: 'Soft delete bài viết' },
    });

    return { message: 'Đã xóa bài viết thành công' };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronPostStatus() {
    const now = new Date();
    try {
      const result = await this.postModel.updateMany(
        {
          status: PostStatus.SCHEDULED,
          published_at: { $lte: now },
          is_deleted: false,
        },
        { $set: { status: PostStatus.PUBLISHED } },
      );

      if (result.modifiedCount > 0) {
        this.logger.log(
          `[CRON] Đã tự động publish ${result.modifiedCount} bài viết.`,
        );
      }
    } catch (error) {
      this.logger.error('Lỗi khi chạy Cronjob publish bài viết:', error);
    }
  }

  // XỬ LÝ STATIC PAGES (US.126)

  async createPage(dto: CreateStaticPageDto, userId: string, email: string) {
    // FIX: Ép kiểu rõ ràng tham số dto.slug thành string (chặn unsafe-argument)
    await this.checkSlugExist(String(dto.slug));

    const newPage = new this.pageModel(dto);
    const savedPage = await newPage.save();

    await this.auditLogsService.log({
      action: 'CREATE',
      collection_name: Resource.BLOG,
      actor_id: userId,
      actor_email: email,
      target_id: savedPage._id, // FIX: Bỏ ép kiểu
      department: Department.MARKETING,
      detail: { title: savedPage.title, slug: savedPage.slug },
    });

    return savedPage;
  }

  async softDeletePage(id: string, userId: string, email: string) {
    const page = await this.pageModel.findById(id);
    if (!page || page.is_deleted)
      throw new NotFoundException('Không tìm thấy trang tĩnh');

    if (page.is_system) {
      throw new BadRequestException(
        'Không thể xóa trang hệ thống mặc định (Bảo mật, 404, Trang chủ...).',
      );
    }

    page.is_deleted = true;
    page.deleted_at = new Date();
    page.status = PageStatus.HIDDEN;
    await page.save();

    await this.auditLogsService.log({
      action: 'DELETE',
      collection_name: Resource.BLOG,
      actor_id: userId,
      actor_email: email,
      target_id: page._id, // FIX: Bỏ ép kiểu
      department: Department.MARKETING,
      detail: { reason: 'Soft delete trang tĩnh' },
    });

    return { message: 'Đã xóa trang thành công' };
  }

  // XỬ LÝ BANNERS

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

  async trackClick(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID Banner không hợp lệ');
    }

    const banner = await this.bannerModel
      .findOne({ _id: id, is_deleted: false })
      .select('_id');
    if (!banner) {
      throw new NotFoundException('Banner không tồn tại hoặc đã bị xóa');
    }

    await this.bannerModel.updateOne({ _id: id }, { $inc: { clicks: 1 } });
    return { success: true };
  }

  async findAll(query: QueryBannerDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

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

  async findOne(id: string) {
    const banner = await this.bannerModel
      .findOne({ _id: id, is_deleted: false })
      .lean();
    if (!banner) throw new NotFoundException('Không tìm thấy Banner');
    return banner;
  }

  async updateBanner(id: string, dto: UpdateBannerDto) {
    const banner = await this.bannerModel.findOne({
      _id: id,
      is_deleted: false,
    });
    if (!banner) throw new NotFoundException('Không tìm thấy Banner');

    Object.assign(banner, dto);

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

  async reorderBanners(dto: ReorderBannersDto) {
    const bulkOps: AnyBulkWriteOperation<Banner>[] = dto.items.map((item) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(item.id) },
        update: { $set: { display_order: item.display_order } },
      },
    }));

    if (bulkOps.length > 0) {
      await this.bannerModel.bulkWrite(bulkOps);
    }
    return { message: 'Cập nhật thứ tự hiển thị thành công' };
  }

  async getActiveBanners(position: string, categoryId?: string) {
    const filter: FilterQuery<Banner> = {
      status: BannerStatus.ACTIVE,
      is_deleted: false,
      position: position,
    };

    if (categoryId) {
      filter.$or = [
        { category_id: new Types.ObjectId(categoryId) },
        { category_id: null },
      ];
    }

    const banners = await this.bannerModel
      .find(filter)
      .sort({ display_order: 1, created_at: -1 })
      .select('title link image_pc image_mobile position category_id')
      .lean();

    if (banners.length > 0) {
      const bannerIds = banners.map((b) => b._id);
      void this.bannerModel
        .updateMany({ _id: { $in: bannerIds } }, { $inc: { impressions: 1 } })
        .exec()
        .catch((err) => console.error('Lỗi khi track impressions:', err));
    }

    return banners;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronBannerStatus() {
    const now = new Date();

    await this.bannerModel.updateMany(
      { status: BannerStatus.WAITING, start_date: { $lte: now } },
      { $set: { status: BannerStatus.ACTIVE } },
    );

    await this.bannerModel.updateMany(
      { status: BannerStatus.ACTIVE, end_date: { $lte: now } },
      { $set: { status: BannerStatus.HIDDEN } },
    );
  }

  // UPDATE BLOG POST & STATIC PAGE

  async updatePost(
    id: string,
    dto: UpdatePostDto,
    userId: string,
    email: string,
  ) {
    const post = await this.postModel.findById(id);
    if (!post || post.is_deleted)
      throw new NotFoundException('Không tìm thấy bài viết');

    if (dto.slug && dto.slug !== post.slug) {
      await this.checkSlugExist(dto.slug, post._id);
    }

    Object.assign(post, dto);

    // Nếu có đổi lịch đăng
    if (dto.published_at && new Date(dto.published_at) > new Date()) {
      post.status = PostStatus.SCHEDULED;
    }

    const updatedPost = await post.save();

    await this.auditLogsService.log({
      action: 'UPDATE',
      collection_name: Resource.BLOG,
      actor_id: userId,
      actor_email: email,
      target_id: updatedPost._id,
      department: Department.MARKETING,
      detail: { title: updatedPost.title },
    });

    return updatedPost;
  }

  async updatePage(
    id: string,
    dto: UpdateStaticPageDto,
    userId: string,
    email: string,
  ) {
    const page = await this.pageModel.findById(id);
    if (!page || page.is_deleted)
      throw new NotFoundException('Không tìm thấy trang tĩnh');

    if (dto.slug && dto.slug !== page.slug) {
      await this.checkSlugExist(dto.slug, page._id);
    }

    Object.assign(page, dto);
    const updatedPage = await page.save();

    await this.auditLogsService.log({
      action: 'UPDATE',
      collection_name: Resource.BLOG,
      actor_id: userId,
      actor_email: email,
      target_id: updatedPage._id,
      department: Department.MARKETING,
      detail: { title: updatedPage.title },
    });

    return updatedPage;
  }

  // BỔ SUNG: API PUBLIC CHO FRONTEND KHÁCH HÀNG

  async getPublicPostBySlug(slug: string) {
    const post = await this.postModel
      .findOne({ slug, status: PostStatus.PUBLISHED, is_deleted: false })
      .populate('embedded_product_ids', 'name price thumbnail slug') // Load Widget SP
      .lean();
    if (!post)
      throw new NotFoundException('Bài viết không tồn tại hoặc đang bị ẩn');
    return post;
  }

  async getPublicPageBySlug(slug: string) {
    const page = await this.pageModel
      .findOne({ slug, status: PageStatus.PUBLISHED, is_deleted: false })
      .lean();
    if (!page)
      throw new NotFoundException('Trang không tồn tại hoặc đang bị ẩn');
    return page;
  }

  // XỬ LÝ MENU CONFIG (US.126 - AC5)

  async createMenu(dto: CreateMenuDto, userId: string, email: string) {
    const menu = new this.menuModel(dto);
    const savedMenu = await menu.save();

    await this.auditLogsService.log({
      action: 'CREATE',
      collection_name: Resource.SYSTEM, // Menu thuộc cấu hình giao diện
      actor_id: userId,
      actor_email: email,
      target_id: savedMenu._id,
      department: Department.MARKETING,
      detail: { title: savedMenu.title, position: savedMenu.position },
    });
    return savedMenu;
  }

  async getPublicMenus(position: string) {
    return this.menuModel
      .find({ is_active: true, position })
      .sort({ display_order: 1 })
      .lean();
  }

  async getPreviewContentBySlug(slug: string) {
    // Không filter theo status để có thể xem trước cả bài Draft
    const post = await this.postModel
      .findOne({ slug, is_deleted: false })
      .populate('embedded_product_ids', 'name price thumbnail slug')
      .lean();

    if (!post)
      throw new NotFoundException('Không tìm thấy nội dung để xem trước');
    return post;
  }
}
