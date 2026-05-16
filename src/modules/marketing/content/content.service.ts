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
import { StaticPage, PageStatus } from './schemas/static-page.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateStaticPageDto } from './dto/create-static-page.dto';
import { MenuConfig } from './schemas/menu-config.schema';

import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';
import { Resource } from 'src/common/enums/resource.enum';
import {
  CreateMenuDto,
  UpdatePostDto,
  UpdateStaticPageDto,
} from './dto/update-content.dto';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { UpdatePageConfigDto } from './dto/page-config.dto';
import { PageConfig } from './schemas/page-config.schema';

export interface UploadOptions {
  subFolder: string; // Tên thư mục con (VD: 'products', 'users')
  maxImageSize?: number; // Dung lượng tối đa cho ảnh (byte)
  maxVideoSize?: number; // Dung lượng tối đa cho video (byte)
  generateThumbnail?: boolean; // Có tạo ảnh thumb không?
  generateMedium?: boolean; // Có tạo ảnh medium không?
}

export interface QueryBannerDto {
  page?: number | string;
  limit?: number | string;
  position?: string;
  status?: BannerStatus;
}

export interface ProcessedFileResult {
  originalName: string;
  filename: string;
  path: string;
  thumbnail: string;
  medium: string;
  mimetype: string;
  size: number;
  type: string;
}

export interface QueryPostDto {
  page?: number | string;
  limit?: number | string;
  status?: PostStatus;
  category_id?: string;
  search?: string;
}

export interface QueryPageDto {
  page?: number | string;
  limit?: number | string;
  status?: PageStatus;
  search?: string;
  type?: string;
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
    @InjectModel(PageConfig.name) private pageConfigModel: Model<PageConfig>,
  ) {}

  async findAllPages(query: QueryPageDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const filter: FilterQuery<StaticPage> = { is_deleted: false };
    if (query.status) filter.status = query.status;

    if (query.type) filter.type = query.type;

    if (query.search) {
      filter.title = { $regex: String(query.search), $options: 'i' };
    }

    const [data, total] = await Promise.all([
      this.pageModel
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.pageModel.countDocuments(filter),
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

    if (!dto.meta_title && dto.title) {
      // Nếu người dùng không nhập meta_title, tự động lấy title làm meta_title
      dto.meta_title = dto.title;
    }

    // AC6: Tự động trích xuất meta_description từ content nếu bị trống
    if (!dto.meta_description && dto.content) {
      const plainText = dto.content.replace(/<[^>]*>?/gm, '').trim();
      dto.meta_description =
        plainText.length > 150
          ? plainText.substring(0, 150).trim() + '...'
          : plainText;
    }

    let initialStatus = dto.status || PostStatus.DRAFT;
    if (dto.published_at && new Date(dto.published_at) > new Date()) {
      initialStatus = PostStatus.SCHEDULED;
    }

    const newPost = new this.postModel({
      ...dto,
      author_id: new Types.ObjectId(userId),
      status: initialStatus,
    });

    const savedPost = await newPost.save();

    await this.auditLogsService.log({
      action: 'CREATE',
      collection_name: Resource.BLOG,
      actor_id: userId,
      actor_email: email,
      target_id: savedPost._id,
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
      filter.category_id = new Types.ObjectId(String(query.category_id));
    }
    if (query.search) {
      filter.title = { $regex: String(query.search), $options: 'i' };
    }

    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('embedded_product_ids', 'name price thumbnail')
        .populate('author_id', 'email full_name name') // Kéo info user
        .populate('category_id', 'name')
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
      target_id: post._id,
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
    await this.checkSlugExist(String(dto.slug));

    // ĐÃ THÊM: Fallback cho meta_title nếu bị trống
    if (!dto.meta_title && dto.title) {
      dto.meta_title = dto.title;
    }

    if (!dto.meta_description && dto.content) {
      // Loại bỏ HTML tags
      const plainText = dto.content.replace(/<[^>]*>?/gm, '').trim();

      // Lấy 150 ký tự đầu và thêm '...' nếu nội dung gốc dài hơn
      dto.meta_description =
        plainText.length > 150
          ? plainText.substring(0, 150).trim() + '...'
          : plainText;
    }

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
      target_id: page._id,
      department: Department.MARKETING,
      detail: { reason: 'Soft delete trang tĩnh' },
    });

    return { message: 'Đã xóa trang thành công' };
  }

  // XỬ LÝ BANNERS

  async createBanner(dto: CreateBannerDto, userId: string, email: string) {
    const start = new Date(dto.start_date);
    const end = new Date(dto.end_date);
    const now = new Date();

    // RÀNG BUỘC LOGIC NGÀY
    if (start >= end) {
      throw new BadRequestException('Ngày kết thúc phải lớn hơn ngày bắt đầu');
    }

    const newBanner = new this.bannerModel({
      ...dto,
      created_by: email,
      status:
        start <= now && now <= end ? BannerStatus.ACTIVE : BannerStatus.WAITING,
    });

    const savedBanner = await newBanner.save();

    // BỔ SUNG AUDIT LOG
    await this.auditLogsService.log({
      action: 'CREATE',
      collection_name: 'banners',
      actor_id: userId,
      actor_email: email,
      target_id: savedBanner._id,
      department: Department.MARKETING,
      detail: { title: savedBanner.title, position: savedBanner.position },
    });

    return savedBanner;
  }

  async softDeleteBanner(id: string, userId: string, email: string) {
    const banner = await this.bannerModel.findById(id);
    if (!banner || banner.is_deleted) {
      throw new NotFoundException('Không tìm thấy Banner');
    }

    banner.is_deleted = true;
    banner.deleted_at = new Date();
    banner.status = BannerStatus.HIDDEN;
    await banner.save();

    // BỔ SUNG AUDIT LOG (AC6)
    await this.auditLogsService.log({
      action: 'DELETE',
      collection_name: 'banners',
      actor_id: userId,
      actor_email: email,
      target_id: banner._id,
      department: Department.MARKETING,
      detail: { reason: 'Soft delete banner' },
    });

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

    if (!dto.meta_title && dto.title) {
      // Nếu người dùng không nhập meta_title, tự động lấy title làm meta_title
      dto.meta_title = dto.title;
    }

    // AC6: Tự động trích xuất meta_description từ content nếu bị trống
    if (!dto.meta_description && dto.content) {
      const plainText = dto.content.replace(/<[^>]*>?/gm, '').trim();
      dto.meta_description =
        plainText.length > 150
          ? plainText.substring(0, 150).trim() + '...'
          : plainText;
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

    // ĐÃ THÊM: Fallback cho meta_title nếu bị trống trước khi assign
    if (!dto.meta_title && dto.title) {
      dto.meta_title = dto.title;
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

  // 1. Logic xử lý và lưu file
  // 1. Logic xử lý và lưu file
  async processAndSaveFiles(
    files: Array<Express.Multer.File>,
    options: UploadOptions,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Không có file nào được tải lên');
    }

    // Đã thay thế any[] bằng mảng chứa Interface cụ thể
    const processedFiles: ProcessedFileResult[] = [];
    const uploadDir = path.join(process.cwd(), `uploads/${options.subFolder}`);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const maxImageSize = options.maxImageSize || 50 * 1024 * 1024;
    const maxVideoSize = options.maxVideoSize || 200 * 1024 * 1024;

    for (const file of files) {
      const isVideo = file.mimetype.startsWith('video/');
      const allowedImageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

      if (!isVideo && !allowedImageMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Định dạng file "${file.originalname}" không hỗ trợ.`,
        );
      }

      if (!isVideo && file.size > maxImageSize) {
        throw new BadRequestException(
          `Ảnh "${file.originalname}" vượt quá giới hạn.`,
        );
      }
      if (isVideo && file.size > maxVideoSize) {
        throw new BadRequestException(
          `Video "${file.originalname}" vượt giới hạn.`,
        );
      }

      const filename = `${options.subFolder}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname).toLowerCase();
      const originalPath = path.join(uploadDir, `${filename}${ext}`);
      const relativePath = `/uploads/${options.subFolder}/${filename}${ext}`;

      if (isVideo) {
        fs.writeFileSync(originalPath, file.buffer);
        processedFiles.push({
          originalName: file.originalname,
          filename: `${filename}${ext}`,
          path: relativePath,
          thumbnail: relativePath,
          medium: relativePath,
          mimetype: file.mimetype,
          size: file.size,
          type: 'VIDEO',
        });
      } else {
        await sharp(file.buffer).toFile(originalPath);

        let thumbPathRelative = relativePath;
        let mediumPathRelative = relativePath;

        if (options.generateThumbnail) {
          const thumbName = `${filename}-thumb${ext}`;
          const thumbPath = path.join(uploadDir, thumbName);
          await sharp(file.buffer)
            .resize(200, 200, { fit: 'cover' })
            .toFile(thumbPath);
          thumbPathRelative = `/uploads/${options.subFolder}/${thumbName}`;
        }

        if (options.generateMedium) {
          const mediumName = `${filename}-medium${ext}`;
          const mediumPath = path.join(uploadDir, mediumName);
          await sharp(file.buffer)
            .resize(800, null, { withoutEnlargement: true })
            .toFile(mediumPath);
          mediumPathRelative = `/uploads/${options.subFolder}/${mediumName}`;
        }

        processedFiles.push({
          originalName: file.originalname,
          filename: `${filename}${ext}`,
          path: relativePath,
          thumbnail: thumbPathRelative,
          medium: mediumPathRelative,
          mimetype: file.mimetype,
          size: file.size,
          type: 'IMAGE',
        });
      }
    }

    return {
      message: 'Tải lên và xử lý file thành công',
      data: processedFiles,
    };
  }

  // 2. Logic xóa file vật lý (Chuyển từ ProductsService sang)
  deletePhysicalFile(relativePath: string) {
    if (!relativePath) return;
    try {
      const absolutePath = path.join(process.cwd(), relativePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`[FILE] Deleted: ${absolutePath}`);
      }
    } catch (error) {
      console.error(`[FILE] Error deleting file: ${relativePath}`, error);
    }
  }

  async bulkUpdateBannerStatus(
    ids: string[],
    status: BannerStatus,
    userId: string,
    email: string,
  ) {
    // Dùng toán tử $in để update 1 lần duy nhất trên MongoDB
    const result = await this.bannerModel.updateMany(
      {
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
        is_deleted: false,
      },
      { $set: { status: status } },
    );

    // Lưu Audit Log 1 lần cho cả cụm
    await this.auditLogsService.log({
      action: 'UPDATE',
      collection_name: 'banners',
      actor_id: userId,
      actor_email: email,
      target_id: 'BULK_UPDATE',
      department: Department.MARKETING,
      detail: {
        reason: `Bulk change status to ${status} for ${ids.length} banners`,
      },
    });

    return {
      message: `Đã cập nhật thành công ${result.modifiedCount} banners`,
    };
  }

  // --- BỔ SUNG BULK ACTIONS CHO BLOG POSTS (US.125) ---

  async bulkUpdatePostStatus(
    ids: string[],
    status: PostStatus,
    userId: string,
    email: string,
  ) {
    const result = await this.postModel.updateMany(
      {
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
        is_deleted: false,
      },
      { $set: { status: status } },
    );

    await this.auditLogsService.log({
      action: 'UPDATE',
      collection_name: Resource.BLOG,
      actor_id: userId,
      actor_email: email,
      target_id: 'BULK_UPDATE_POSTS',
      department: Department.MARKETING,
      detail: {
        reason: `Bulk change status to ${status} for ${ids.length} posts`,
      },
    });

    return {
      message: `Đã cập nhật trạng thái thành công ${result.modifiedCount} bài viết`,
    };
  }

  async bulkDeletePosts(ids: string[], userId: string, email: string) {
    const result = await this.postModel.updateMany(
      {
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
        is_deleted: false,
      },
      {
        $set: {
          is_deleted: true,
          deleted_at: new Date(),
          status: PostStatus.HIDDEN,
        },
      },
    );

    await this.auditLogsService.log({
      action: 'DELETE',
      collection_name: Resource.BLOG,
      actor_id: userId,
      actor_email: email,
      target_id: 'BULK_DELETE_POSTS',
      department: Department.MARKETING,
      detail: { reason: `Soft delete ${ids.length} posts` },
    });

    return {
      message: `Đã xóa mềm ${result.modifiedCount} bài viết thành công`,
    };
  }

  // --- BỔ SUNG LOGIC PAGE BUILDER CONFIG ---

  async getPageConfig(pageId: string) {
    const config = await this.pageConfigModel.findOne({ pageId }).lean();
    if (!config) {
      // Nếu chưa có, trả về mảng rỗng để FE xử lý
      return { pageId, sections: [] };
    }
    return config;
  }

  async updatePageConfig(
    pageId: string,
    dto: UpdatePageConfigDto,
    userId: string,
    email: string,
  ) {
    // Dùng kỹ thuật Upsert: Update nếu tồn tại, Create nếu chưa có
    const updatedConfig = await this.pageConfigModel.findOneAndUpdate(
      { pageId },
      { $set: { sections: dto.sections } },
      { new: true, upsert: true }, // upsert: true là chìa khóa ở đây
    );

    // Ghi Audit Log cho hệ thống
    await this.auditLogsService.log({
      action: 'UPDATE',
      collection_name: Resource.SYSTEM,
      actor_id: userId,
      actor_email: email,
      target_id: updatedConfig._id,
      department: Department.MARKETING,
      detail: { reason: `Cập nhật cấu hình giao diện trang: ${pageId}` },
    });

    return updatedConfig;
  }
}
