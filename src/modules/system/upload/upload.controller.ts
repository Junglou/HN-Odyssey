import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  imageVideoFileFilter,
  storageConfig,
} from '../../../common/utils/file-upload.util';
import { Public } from '../../../common/decorators/public.decorator';
import { UploadService } from './upload.service';

// Cấu hình lưu trữ bộ nhớ tạm
const memoryStorageConfig = {
  storage: storageConfig(),
  fileFilter: imageVideoFileFilter,
};

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Public()
  @Post('single')
  @UseInterceptors(
    FileInterceptor('file', {
      ...memoryStorageConfig,
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'File không hợp lệ hoặc quá dung lượng (Max 50MB)',
      );
    }

    const result = await this.uploadService.uploadFile(file, 'media');

    return {
      filename: file.originalname,
      path: result.secure_url, // Trả về https://res.cloudinary.com/...
      mimetype: file.mimetype,
    };
  }

  @Public()
  @Post('multiple')
  @UseInterceptors(
    FilesInterceptor('files', 50, {
      ...memoryStorageConfig,
      limits: { fileSize: 200 * 1024 * 1024 },
    }),
  )
  async uploadMultipleFiles(
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 file');
    }

    // Đẩy song song tất cả các file lên Cloudinary
    const uploadPromises = files.map((file) =>
      this.uploadService.uploadFile(file, 'media'),
    );
    const results = await Promise.all(uploadPromises);

    const response = files.map((file, index) => ({
      filename: file.originalname,
      path: results[index].secure_url, // Trả về https://res.cloudinary.com/...
      mimetype: file.mimetype,
    }));

    return {
      data: response,
    };
  }
}
