import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import {
  editFileName,
  imageVideoFileFilter,
} from '../../../common/utils/file-upload.util';
import { Public } from '../../../common/decorators/public.decorator';

// Cấu hình lưu trữ
const storageConfig = {
  storage: diskStorage({
    destination: './uploads', // Thư mục lưu file
    filename: editFileName,
  }),
  fileFilter: imageVideoFileFilter,
};

@Controller('upload')
export class UploadController {
  // API 1: Upload 1 file (Ảnh đại diện)
  @Public() // Cho phép public để test dễ, sau này có thể chặn
  @Post('single')
  @UseInterceptors(
    FileInterceptor('file', {
      ...storageConfig,
      limits: { fileSize: 20 * 1024 * 1024 }, // Max 20MB cho ảnh
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'File không hợp lệ hoặc quá dung lượng (Max 20MB)',
      );
    }

    // Trả về đường dẫn file để FE hiển thị
    return {
      filename: file.filename,
      path: `/uploads/${file.filename}`, // URL tương đối
      mimetype: file.mimetype,
    };
  }

  // API 2: Upload nhiều file (Album ảnh sản phẩm)
  @Public()
  @Post('multiple')
  @UseInterceptors(
    FilesInterceptor('files', 50, {
      // Max 50 file cùng lúc
      ...storageConfig,
      limits: { fileSize: 200 * 1024 * 1024 }, // Max 200MB (để hỗ trợ video)
    }),
  )
  uploadMultipleFiles(@UploadedFiles() files: Array<Express.Multer.File>) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 file');
    }

    const response = files.map((file) => ({
      filename: file.filename,
      path: `/uploads/${file.filename}`,
      mimetype: file.mimetype,
    }));

    return {
      data: response,
    };
  }
}
