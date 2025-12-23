import { extname } from 'path';
import { HttpException, HttpStatus } from '@nestjs/common';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';

// [1] LOGIC ĐỔI TÊN FILE (Tách riêng để tái sử dụng)
export const editFileName = (req, file, cb) => {
  const randomName = uuidv4();
  const extension = extname(file.originalname);
  cb(null, `${randomName}${extension}`);
};

// [2] BỘ LỌC ĐỊNH DẠNG FILE
export const fileFilter = (req, file, cb) => {
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

// [3] CẤU HÌNH STORAGE (Dùng cho ProductsController)
export const storageConfig = (folder: string) =>
  diskStorage({
    destination: `./uploads/${folder}`,
    filename: editFileName, // Tái sử dụng logic đổi tên ở trên
  });

// [4] GIỚI HẠN DUNG LƯỢNG
export const limits = {
  fileSize: 50 * 1024 * 1024, // Max 50MB
};

// [5] ALIAS (Tạo tên giả để tương thích với UploadController cũ của bạn)
// Giúp fix lỗi "has no exported member 'imageVideoFileFilter'"
export const imageVideoFileFilter = fileFilter;
