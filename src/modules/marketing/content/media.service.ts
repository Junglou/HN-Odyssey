import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { Media, MediaType } from './schemas/media-record.schema';
import {
  MediaMetadataDto,
  QueryMediaInterface,
  UpdateMediaInfoDto,
} from './dto/media-record.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface UploadResponseInterface {
  id: string;
  url: string;
  fileName: string;
  size: number;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectModel(Media.name) private mediaModel: Model<Media>,
    private eventEmitter: EventEmitter2,
  ) {}

  // Xử lý lưu mảng file và metadata
  async uploadBulkMedia(
    files: Express.Multer.File[],
    metadataArray: MediaMetadataDto[],
    userId: string,
  ): Promise<Media[]> {
    if (files.length !== metadataArray.length) {
      throw new BadRequestException('Số lượng file và metadata không khớp.');
    }

    const uploadDir = path.join(process.cwd(), 'uploads/media');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const savedRecords: Media[] = [];
    // Map kiểm tra xem targetId đã có ảnh primary nào trong DB chưa
    const targetCheckMap = new Map<string, boolean>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = metadataArray[i];

      // LOGIC: Tự động set Primary cho ảnh đầu tiên nếu chưa có
      let isPrimaryFlag = false;
      const targetKey = `${meta.type}_${meta.targetId}`;

      if (!targetCheckMap.has(targetKey)) {
        const existingPrimary = await this.mediaModel.exists({
          targetId: String(meta.targetId),
          type: String(meta.type),
          isPrimary: true,
        });
        if (!existingPrimary) {
          isPrimaryFlag = true;
        }
        targetCheckMap.set(targetKey, true); // Đánh dấu là đã xử lý kiểm tra
      }

      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      const safePhysicalName = `media-${uniqueSuffix}${ext}`;
      const physicalPath = path.join(uploadDir, safePhysicalName);
      const relativeUrl = `/uploads/media/${safePhysicalName}`;

      fs.writeFileSync(physicalPath, file.buffer);

      const newMedia = new this.mediaModel({
        url: relativeUrl,
        fileName: safePhysicalName,
        originalName: String(file.originalname),
        type: String(meta.type),
        targetId: String(meta.targetId),
        status: String(meta.status),
        altText: meta.altText ? String(meta.altText) : '',
        size: Number(file.size),
        mimetype: String(file.mimetype),
        created_by: new Types.ObjectId(userId),
        isPrimary: isPrimaryFlag, // Đã fix: Không set cứng false nữa
      });

      const saved = await newMedia.save();
      savedRecords.push(saved);

      // Bắn event ngay lập tức nếu ảnh này được chọn làm Primary tự động
      if (isPrimaryFlag) {
        if (meta.type === MediaType.PRODUCT) {
          this.eventEmitter.emit('product.thumbnail.updated', {
            productId: meta.targetId,
            thumbnailUrl: relativeUrl,
          });
        } else if (meta.type === MediaType.VARIANT) {
          // Quy ước: targetId của Variant khi upload lên là SKU của nó
          this.eventEmitter.emit('variant.thumbnail.updated', {
            variantSku: meta.targetId,
            thumbnailUrl: relativeUrl,
          });
        }
      }
    }

    // LOGIC: Gom nhóm và bắn Event upload hàng loạt để cập nhật mảng images/gallery
    const groupedByTarget = savedRecords.reduce(
      (acc, curr) => {
        const key = `${curr.type}_${curr.targetId}`;
        if (!acc[key]) {
          acc[key] = { type: curr.type, targetId: curr.targetId, urls: [] };
        }
        acc[key].urls.push(curr.url);
        return acc;
      },
      {} as Record<
        string,
        { type: MediaType; targetId: string; urls: string[] }
      >,
    );

    Object.values(groupedByTarget).forEach((group) => {
      this.eventEmitter.emit('media.bulk.uploaded', {
        targetId: group.targetId,
        type: group.type,
        urls: group.urls,
      });
    });

    return savedRecords;
  }

  // Lấy danh sách có phân trang
  async getMediaList(query: QueryMediaInterface) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const filter: FilterQuery<Media> = {};

    if (query.status && query.status !== 'All') {
      filter.status = String(query.status);
    }
    if (query.type && query.type !== 'All') {
      filter.type = String(query.type);
    }
    if (query.search) {
      // Đã fix no-unsafe-assignment bằng việc dùng RegExp object thay cho `$regex` string
      const searchRegex = new RegExp(String(query.search), 'i');
      filter.$or = [{ originalName: searchRegex }, { altText: searchRegex }];
    }

    const [data, total] = await Promise.all([
      this.mediaModel
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.mediaModel.countDocuments(filter),
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

  // Chỉnh sửa thông tin
  async updateMediaInfo(id: string, dto: UpdateMediaInfoDto) {
    const media = await this.mediaModel.findById(id);
    if (!media) throw new NotFoundException('Không tìm thấy phương tiện.');

    // FIX LỖI ESLINT: Gán tường minh thay vì dùng Object.keys() sinh ra dynamic type (any)
    if (dto.type !== undefined) media.type = dto.type;
    if (dto.targetId !== undefined) media.targetId = dto.targetId;
    if (dto.altText !== undefined) media.altText = dto.altText;
    if (dto.status !== undefined) media.status = dto.status;
    if (dto.isPrimary !== undefined) media.isPrimary = dto.isPrimary;

    return media.save();
  }

  // AC3: Đặt làm ảnh đại diện
  async setPrimaryMedia(id: string) {
    const media = await this.mediaModel.findById(id);
    if (!media) throw new NotFoundException('Không tìm thấy phương tiện.');

    if (media.mimetype.startsWith('video/')) {
      throw new BadRequestException(
        'Hệ thống vô hiệu hóa chức năng đặt ảnh đại diện đối với video.',
      );
    }

    await this.mediaModel.updateMany(
      { targetId: media.targetId, type: media.type },
      { $set: { isPrimary: false } },
    );

    media.isPrimary = true;
    const savedMedia = await media.save();

    // Đã fix: Bổ sung rẽ nhánh bắn event cho cả Variant
    if (media.type === MediaType.PRODUCT) {
      this.eventEmitter.emit('product.thumbnail.updated', {
        productId: media.targetId,
        thumbnailUrl: media.url,
      });
    } else if (media.type === MediaType.VARIANT) {
      this.eventEmitter.emit('variant.thumbnail.updated', {
        variantSku: media.targetId, // targetId truyền từ fontend lúc này phải là SKU của Variant
        thumbnailUrl: media.url,
      });
    }

    return savedMedia;
  }

  // AC3: Xử lý lưu ảnh sau khi Crop
  async saveCroppedImage(
    id: string,
    file: Express.Multer.File,
  ): Promise<UploadResponseInterface> {
    const media = await this.mediaModel.findById(id);
    if (!media) throw new NotFoundException('Không tìm thấy phương tiện.');

    if (media.mimetype.startsWith('video/')) {
      throw new BadRequestException(
        'Hệ thống vô hiệu hóa chức năng cắt ảnh đối với video.',
      );
    }

    const uploadDir = path.join(process.cwd(), 'uploads/media');
    const uniqueSuffix = `${Date.now()}-cropped`;
    const safePhysicalName = `media-${uniqueSuffix}.jpg`;
    const physicalPath = path.join(uploadDir, safePhysicalName);
    const relativeUrl = `/uploads/media/${safePhysicalName}`;

    // Lưu file crop mới
    fs.writeFileSync(physicalPath, file.buffer);

    // Xóa file cũ khỏi ổ cứng
    this.deletePhysicalFile(media.url);

    // Cập nhật DB
    media.url = relativeUrl;
    media.fileName = safePhysicalName;
    media.size = file.size;
    await media.save();

    return {
      id: media._id.toString(),
      url: media.url,
      fileName: media.originalName,
      size: media.size,
    };
  }

  // Thay thế file (Replace)
  async replaceMedia(
    id: string,
    file: Express.Multer.File,
  ): Promise<UploadResponseInterface> {
    const media = await this.mediaModel.findById(id);
    if (!media) throw new NotFoundException('Không tìm thấy phương tiện.');

    const uploadDir = path.join(process.cwd(), 'uploads/media');
    const ext = path.extname(file.originalname);
    const uniqueSuffix = `${Date.now()}-replaced`;
    const safePhysicalName = `media-${uniqueSuffix}${ext}`;
    const physicalPath = path.join(uploadDir, safePhysicalName);
    const relativeUrl = `/uploads/media/${safePhysicalName}`;

    fs.writeFileSync(physicalPath, file.buffer);
    this.deletePhysicalFile(media.url);

    media.url = relativeUrl;
    media.fileName = safePhysicalName;
    media.originalName = file.originalname;
    media.size = file.size;
    media.mimetype = file.mimetype;
    await media.save();

    return {
      id: media._id.toString(),
      url: media.url,
      fileName: media.originalName,
      size: media.size,
    };
  }

  // AC5: Xóa phương tiện hoàn toàn khỏi bộ nhớ
  async hardDeleteMedia(id: string) {
    const media = await this.mediaModel.findById(id);
    if (!media) throw new NotFoundException('Không tìm thấy phương tiện.');

    // Lưu tạm các thông tin cần thiết trước khi xóa khỏi DB
    const deletedUrl = media.url;
    const targetId = media.targetId;
    const type = media.type;

    // Xóa file vật lý khỏi ổ cứng
    this.deletePhysicalFile(media.url);

    // Xóa khỏi Database hoàn toàn
    await this.mediaModel.findByIdAndDelete(id);

    // THÊM ĐOẠN NÀY: Bắn event để dọn dẹp chuỗi string lưu bên Product/Variant
    this.eventEmitter.emit('media.deleted', {
      targetId: targetId,
      type: type,
      url: deletedUrl,
    });

    return { message: 'Đã xóa hoàn toàn phương tiện khỏi hệ thống và bộ nhớ.' };
  }

  // Xóa toàn bộ phương tiện liên kết với một đối tượng khi đối tượng đó bị xóa
  async deleteMediaByTarget(targetId: string, type: string): Promise<void> {
    const medias = await this.mediaModel.find({
      targetId: String(targetId),
      type: String(type),
    });

    for (const media of medias) {
      this.deletePhysicalFile(media.url);
    }

    await this.mediaModel.deleteMany({
      targetId: String(targetId),
      type: String(type),
    });

    this.logger.log(
      `Đã dọn dẹp toàn bộ phương tiện của ${type} có ID: ${targetId}`,
    );
  }

  private deletePhysicalFile(relativePath: string) {
    if (!relativePath) return;
    try {
      const absolutePath = path.join(process.cwd(), relativePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        this.logger.log(`[FILE] Deleted physically: ${absolutePath}`);
      }
    } catch (error: unknown) {
      // FIX LỖI ESLINT BẰNG unknown THAY VÌ implicit any
      this.logger.error(
        `[FILE] Error deleting physical file: ${relativePath}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // Tự động ẩn toàn bộ ảnh của một đối tượng khi đối tượng đó bị ẩn/xóa mềm
  async bulkUpdateStatusByTarget(
    targetId: string,
    status: string,
  ): Promise<void> {
    await this.mediaModel.updateMany(
      { targetId: String(targetId) },
      { $set: { status: String(status) } },
    );
    this.logger.log(
      `[MEDIA AUTOMATION] Đã chuyển toàn bộ ảnh của targetId ${targetId} sang trạng thái: ${status}`,
    );
  }
}
