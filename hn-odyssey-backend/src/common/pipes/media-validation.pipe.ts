import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { Express } from 'express';

@Injectable()
export class MediaValidationPipe implements PipeTransform<
  Express.Multer.File[],
  Express.Multer.File[]
> {
  transform(files: Express.Multer.File[]): Express.Multer.File[] {
    if (!files || files.length === 0) {
      throw new BadRequestException('Không có tệp tin nào được tải lên.');
    }

    // AC2: Tối đa 50 file trong 1 lượt
    if (files.length > 50) {
      throw new BadRequestException(
        'Vượt quá giới hạn 50 tệp tin cho một lượt tải lên.',
      );
    }

    const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const VIDEO_TYPES = ['video/mp4'];
    const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

    for (const file of files) {
      const isImage = IMAGE_TYPES.includes(file.mimetype);
      const isVideo = VIDEO_TYPES.includes(file.mimetype);

      // AC1: Sai định dạng
      if (!isImage && !isVideo) {
        throw new BadRequestException(
          `Định dạng tệp "${file.originalname}" không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP, MP4.`,
        );
      }

      // AC1: Quá dung lượng ảnh
      if (isImage && file.size > MAX_IMAGE_SIZE) {
        throw new BadRequestException(
          `Ảnh "${file.originalname}" vượt quá giới hạn 50MB. Vui lòng chọn ảnh nhẹ hơn.`,
        );
      }

      // AC1: Quá dung lượng video
      if (isVideo && file.size > MAX_VIDEO_SIZE) {
        throw new BadRequestException(
          `Video "${file.originalname}" vượt quá giới hạn 200MB.`,
        );
      }
    }

    return files;
  }
}
