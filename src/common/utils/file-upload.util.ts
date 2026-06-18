import { HttpException, HttpStatus } from '@nestjs/common';
import { memoryStorage } from 'multer'; // THAY ĐỔI
import { Request } from 'express';

type MulterFilterCallback = (error: any, acceptFile: boolean) => void;

// Định dạng giữ nguyên theo hệ thống cũ
export const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: MulterFilterCallback,
) => {
  if (file.mimetype.match(/\/(jpg|jpeg|png|webp|mp4)$/)) {
    cb(null, true);
  } else {
    cb(
      new HttpException(
        `Định dạng file không hợp lệ! Chỉ chấp nhận ảnh (JPG, PNG, WEBP) hoặc Video (MP4).`,
        HttpStatus.BAD_REQUEST,
      ),
      false,
    );
  }
};

// THAY ĐỔI: Chuyển sang lưu trên RAM
export const storageConfig = () => memoryStorage();

export const limits = {
  fileSize: 50 * 1024 * 1024,
};

export const imageVideoFileFilter = fileFilter;
