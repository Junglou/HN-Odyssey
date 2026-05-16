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
import { Media } from './schemas/media-record.schema';
import {
  MediaMetadataDto,
  QueryMediaInterface,
  UpdateMediaInfoDto,
} from './dto/media-record.dto';

export interface UploadResponseInterface {
  id: string;
  url: string;
  fileName: string;
  size: number;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(@InjectModel(Media.name) private mediaModel: Model<Media>) {}

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

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = metadataArray[i];

      // Đảm bảo tên file duy nhất nhưng giữ được AC2
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      // Loại bỏ ký tự nguy hiểm cho tên file vật lý, nhưng vẫn lưu tên gốc vào originalName
      const safePhysicalName = `media-${uniqueSuffix}${ext}`;
      const physicalPath = path.join(uploadDir, safePhysicalName);
      const relativeUrl = `/uploads/media/${safePhysicalName}`;

      // Ghi file vật lý
      fs.writeFileSync(physicalPath, file.buffer);

      // Lưu Database
      const newMedia = new this.mediaModel({
        url: relativeUrl,
        fileName: safePhysicalName,
        originalName: String(file.originalname), // AC2: Giữ nguyên tên gốc để hiển thị
        type: String(meta.type),
        targetId: String(meta.targetId), // Đã fix no-unsafe-assignment
        status: String(meta.status),
        altText: meta.altText ? String(meta.altText) : '', // Đã fix no-unsafe-assignment
        size: Number(file.size),
        mimetype: String(file.mimetype),
        created_by: new Types.ObjectId(userId),
        isPrimary: false, // Mặc định luôn false khi mới upload
      });

      const saved = await newMedia.save();
      savedRecords.push(saved);
    }

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

    // AC3: Không cho phép Video làm ảnh đại diện
    if (media.mimetype.startsWith('video/')) {
      throw new BadRequestException(
        'Hệ thống vô hiệu hóa chức năng đặt ảnh đại diện đối với video.',
      );
    }

    // Reset toàn bộ các ảnh cùng targetId về false
    await this.mediaModel.updateMany(
      { targetId: media.targetId, type: media.type },
      { $set: { isPrimary: false } },
    );

    media.isPrimary = true;
    return media.save();
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

    // Xóa file vật lý khỏi ổ cứng
    this.deletePhysicalFile(media.url);

    // Xóa khỏi Database hoàn toàn
    await this.mediaModel.findByIdAndDelete(id);

    return { message: 'Đã xóa hoàn toàn phương tiện khỏi hệ thống và bộ nhớ.' };
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
