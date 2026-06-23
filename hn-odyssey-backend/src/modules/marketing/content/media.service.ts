import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import * as path from 'path';
import { Media, MediaStatus, MediaType } from './schemas/media-record.schema';
import {
  MediaMetadataDto,
  QueryMediaInterface,
  UpdateMediaInfoDto,
} from './dto/media-record.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UploadService } from 'src/modules/system/upload/upload.service';

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
    private readonly uploadService: UploadService,
  ) {}

  private async deletePhysicalFile(fileUrl: string) {
    if (!fileUrl) return;
    try {
      // Gọi service xóa file trên Cloud
      await this.uploadService.deleteFile(fileUrl);
      this.logger.log(
        `[CLOUD FILE] Đã xóa thành công khỏi Cloudinary: ${fileUrl}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `[CLOUD FILE] Lỗi khi xóa file trên Cloud: ${fileUrl}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // Xử lý lưu mảng file và metadata
  async uploadBulkMedia(
    files: Express.Multer.File[],
    metadataArray: MediaMetadataDto[],
    userId: string,
  ): Promise<Media[]> {
    if (files.length !== metadataArray.length) {
      throw new BadRequestException('Số lượng file và metadata không khớp.');
    }

    const savedRecords: Media[] = [];
    const targetCheckMap = new Map<string, boolean>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = metadataArray[i];

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
        targetCheckMap.set(targetKey, true);
      }

      const safePhysicalName = `media-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;

      // THAY ĐỔI: Đẩy file thẳng lên Cloudinary
      const uploadResult = await this.uploadService.uploadFile(file, 'media');

      const newMedia = new this.mediaModel({
        url: uploadResult.secure_url, // Lấy link HTTPS từ Cloudinary
        fileName: safePhysicalName,
        originalName: String(file.originalname),
        type: String(meta.type),
        targetId: String(meta.targetId),
        status: String(meta.status),
        altText: meta.altText ? String(meta.altText) : '',
        size: Number(file.size),
        mimetype: String(file.mimetype),
        created_by: new Types.ObjectId(userId),
        isPrimary: isPrimaryFlag,
      });

      const saved = await newMedia.save();
      savedRecords.push(saved);

      if (isPrimaryFlag) {
        if (meta.type === MediaType.PRODUCT) {
          this.eventEmitter.emit('product.thumbnail.updated', {
            productId: meta.targetId,
            thumbnailUrl: uploadResult.secure_url,
          });
        } else if (meta.type === MediaType.VARIANT) {
          this.eventEmitter.emit('variant.thumbnail.updated', {
            variantSku: meta.targetId,
            thumbnailUrl: uploadResult.secure_url,
          });
        }
      }
    }
    const publishedRecords = savedRecords.filter(
      (r) => r.status === MediaStatus.PUBLISHED,
    );

    const groupedByTarget = publishedRecords.reduce(
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

    const oldStatus = media.status;

    // FIX LỖI ESLINT: Gán tường minh thay vì dùng Object.keys() sinh ra dynamic type (any)
    if (dto.type !== undefined) media.type = dto.type;
    if (dto.targetId !== undefined) media.targetId = dto.targetId;
    if (dto.altText !== undefined) media.altText = dto.altText;
    if (dto.status !== undefined) media.status = dto.status;
    if (dto.isPrimary !== undefined) media.isPrimary = dto.isPrimary;

    const savedMedia = await media.save();

    // Bắn sự kiện đồng bộ nếu trạng thái thay đổi để product.listener xử lý
    if (dto.status !== undefined && oldStatus !== dto.status) {
      this.eventEmitter.emit('media.status.changed', {
        targetId: media.targetId,
        type: media.type,
        url: media.url,
        status: dto.status,
      });
    }

    return savedMedia;
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

    // Tải file crop mới lên Cloudinary
    const uploadResult = await this.uploadService.uploadFile(file, 'media');

    // Xóa file cũ khỏi Cloudinary
    await this.deletePhysicalFile(media.url);

    // Cập nhật DB
    media.url = uploadResult.secure_url;
    media.fileName = `media-${Date.now()}-cropped.jpg`;
    media.size = file.size;
    await media.save();

    return {
      id: media._id.toString(),
      url: media.url,
      fileName: media.originalName,
      size: media.size,
    };
  }

  async replaceMedia(
    id: string,
    file: Express.Multer.File,
  ): Promise<UploadResponseInterface> {
    const media = await this.mediaModel.findById(id);
    if (!media) throw new NotFoundException('Không tìm thấy phương tiện.');

    // Tải file mới lên Cloudinary
    const uploadResult = await this.uploadService.uploadFile(file, 'media');

    // Xóa file cũ trên Cloudinary
    await this.deletePhysicalFile(media.url);

    media.url = uploadResult.secure_url;
    media.fileName = `media-${Date.now()}-replaced${path.extname(file.originalname)}`;
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
    await this.deletePhysicalFile(media.url);

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

  async deleteMedia(id: string) {
    // 2. Tìm bản ghi media cũ trong DB để lấy URL ảnh
    const mediaRecord = await this.mediaModel.findById(id);
    if (!mediaRecord) {
      throw new NotFoundException('Không tìm thấy bản ghi media');
    }

    // 3. Tiến hành xóa file vật lý trên Cloudinary trước
    await this.uploadService.deleteFile(mediaRecord.url);

    // 4. Sau đó mới tiến hành xóa bản ghi dưới MongoDB
    return this.mediaModel.findByIdAndDelete(id);
  }

  // Xóa toàn bộ phương tiện liên kết với một đối tượng khi đối tượng đó bị xóa
  async deleteMediaByTarget(targetId: string, type: string): Promise<void> {
    const medias = await this.mediaModel.find({
      targetId: String(targetId),
      type: String(type),
    });

    for (const media of medias) {
      await this.deletePhysicalFile(media.url);
    }

    await this.mediaModel.deleteMany({
      targetId: String(targetId),
      type: String(type),
    });

    this.logger.log(
      `Đã dọn dẹp toàn bộ phương tiện của ${type} có ID: ${targetId}`,
    );
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
