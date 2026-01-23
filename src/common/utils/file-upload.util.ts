import { extname } from 'path';
import { HttpException, HttpStatus } from '@nestjs/common';
import { diskStorage } from 'multer';
import { Request } from 'express';
import { randomUUID } from 'crypto';

// Định nghĩa Type cho Callback của Multer
type MulterFileCallback = (error: Error | null, filename: string) => void;
type MulterFilterCallback = (error: any, acceptFile: boolean) => void;

// 1. LOGIC ĐỔI TÊN FILE
export const editFileName = (
  req: Request,
  file: Express.Multer.File,
  cb: MulterFileCallback,
) => {
  const randomName = randomUUID();

  // Xử lý an toàn cho originalName
  const originalName = file.originalname || '';
  const extension = extname(originalName);
  cb(null, `${randomName}${extension}`);
};

// 2. BỘ LỌC ĐỊNH DẠNG FILE
export const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: MulterFilterCallback,
) => {
  // Chấp nhận ảnh (JPG, PNG, WEBP) và Video (MP4)
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

// 3. CẤU HÌNH STORAGE
export const storageConfig = (folder: string) =>
  diskStorage({
    destination: `./uploads/${folder}`,
    filename: editFileName,
  });

// 4. GIỚI HẠN DUNG LƯỢNG
export const limits = {
  fileSize: 50 * 1024 * 1024, // Max 50MB
};

// 5. ALIAS
export const imageVideoFileFilter = fileFilter;
