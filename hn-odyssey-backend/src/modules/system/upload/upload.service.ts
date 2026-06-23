import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp'; // FIX LỖI: Sử dụng import default thay vì import * as

@Injectable()
export class UploadService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folderName: string,
  ): Promise<UploadApiResponse> {
    let fileBuffer = file.buffer;

    // LOGIC NÉN TỰ ĐỘNG: Nếu là ảnh và nặng hơn 5MB, ép nén xuống định dạng WebP để giảm tối đa dung lượng
    const isImage = file.mimetype.startsWith('image/');
    const thresholdSize = 5 * 1024 * 1024; // 5MB

    if (isImage && file.size > thresholdSize) {
      try {
        fileBuffer = await sharp(file.buffer)
          .webp({ quality: 75 }) // Định dạng WebP siêu nhẹ, giữ nguyên kích thước khung hình
          .toBuffer();
        console.log(`[UploadService] Đã nén tự động file ${file.originalname}`);
      } catch (error) {
        console.error('Lỗi khi nén ảnh với Sharp:', error);
        // Nếu nén thất bại, vẫn cố gắng giữ file gốc để đẩy lên
      }
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `hn-odyssey/${folderName}`,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error || !result) {
            return reject(
              new InternalServerErrorException('Lỗi tải file lên Cloudinary'),
            );
          }
          resolve(result);
        },
      );

      // Sử dụng fileBuffer đã nén (hoặc buffer gốc nếu nhẹ hơn 5MB)
      streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
  }

  // Hàm tự động bóc tách URL để lấy public_id và tiến hành xóa file trên Cloudinary
  // Đổi từ Promise<any> sang Promise<unknown> để an toàn về type
  async deleteFile(fileUrl: string): Promise<unknown> {
    if (!fileUrl || !fileUrl.includes('res.cloudinary.com')) {
      return null;
    }

    try {
      // Ví dụ URL: https://res.cloudinary.com/dq4brtdqu/image/upload/v1718712345/hn-odyssey/media/pic.png
      // Cần bóc tách lấy đoạn: hn-odyssey/media/pic
      const parts = fileUrl.split('/hn-odyssey/');
      if (parts.length < 2) return null;

      const remainingPart = parts[1]; // media/pic.png
      const publicIdWithExt = 'hn-odyssey/' + remainingPart; // hn-odyssey/media/pic.png

      // Loại bỏ phần đuôi định dạng file (.png, .jpg, .webp, .mp4...)
      const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ''); // Kết quả: hn-odyssey/media/pic

      // Xác định loại tài nguyên để xóa (video hoặc image)
      const isVideo = fileUrl.match(/\.(mp4|mkv|webm)$/i);
      const resourceType = isVideo ? 'video' : 'image';

      // Gửi yêu cầu xóa lên Cloudinary và ép kiểu thành unknown để vượt qua lỗi Unsafe Assignment
      const result = (await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      })) as unknown;

      return result;
    } catch (error: unknown) {
      // Ép kiểu bắt buộc block catch phải nhận unknown, sau đó kiểm tra an toàn
      if (error instanceof Error) {
        console.error(
          `❌ Không thể xóa file vật lý trên Cloudinary: ${error.message}`,
        );
      } else {
        console.error(`❌ Không thể xóa file vật lý trên Cloudinary:`, error);
      }
      return null;
    }
  }
}
