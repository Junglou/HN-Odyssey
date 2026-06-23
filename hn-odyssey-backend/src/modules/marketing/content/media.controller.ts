import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { BaseResponse } from 'src/common/dtos/base-response.dto';

// Fix lỗi 1272: Tách biệt import type cho interface
import type { QueryMediaInterface } from './dto/media-record.dto';
import { MediaMetadataDto, UpdateMediaInfoDto } from './dto/media-record.dto';
import { MediaValidationPipe } from 'src/common/pipes/media-validation.pipe';

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
  };
}

@Controller('marketing/media')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  // 1. Lấy danh sách Media (Có search, filter, pagination)
  @Get()
  @RequirePermissions(Resource.BLOG, Action.READ) // Có thể thay bằng Resource.MEDIA nếu bạn tạo Enum mới
  async getMediaList(@Query() query: QueryMediaInterface) {
    const data = await this.mediaService.getMediaList(query);
    return new BaseResponse(true, 'Lấy danh sách Media thành công', data);
  }

  // 2. Upload Bulk Files (AC1, AC2)
  @Post('upload')
  @RequirePermissions(Resource.BLOG, Action.CREATE)
  @UseInterceptors(FilesInterceptor('files', 50)) // Multer chặn > 50 file ở lớp đầu tiên
  async uploadBulkMedia(
    @UploadedFiles(MediaValidationPipe) files: Express.Multer.File[], // Pass qua Pipe để check Size (AC1)
    @Body('metadata') metadataString: string,
    @Req() req: RequestWithUser,
  ) {
    if (!metadataString) {
      throw new BadRequestException('Thiếu chuỗi dữ liệu metadata.');
    }

    let metadataArray: MediaMetadataDto[];
    try {
      // Fix lỗi no-unsafe-assignment bằng ép kiểu tường minh
      metadataArray = JSON.parse(metadataString) as MediaMetadataDto[];
    } catch {
      // Fix lỗi no-unused-vars: Bỏ hẳn tham số e vì không dùng tới
      throw new BadRequestException(
        'Dữ liệu metadata không đúng định dạng JSON.',
      );
    }

    const data = await this.mediaService.uploadBulkMedia(
      files,
      metadataArray,
      req.user.userId,
    );
    return new BaseResponse(
      true,
      `Tải lên ${data.length} tệp tin thành công`,
      data,
    );
  }

  // 3. Cập nhật thông tin (Alt Text, Status, Type, TargetId) (AC4)
  @Patch(':id')
  @RequirePermissions(Resource.BLOG, Action.UPDATE)
  async updateMediaInfo(
    @Param('id') id: string,
    @Body() dto: UpdateMediaInfoDto,
  ) {
    const data = await this.mediaService.updateMediaInfo(id, dto);
    return new BaseResponse(
      true,
      'Cập nhật thông tin phương tiện thành công',
      data,
    );
  }

  // 4. Đặt làm ảnh đại diện (AC3)
  @Patch(':id/primary')
  @RequirePermissions(Resource.BLOG, Action.UPDATE)
  async setPrimaryMedia(@Param('id') id: string) {
    const data = await this.mediaService.setPrimaryMedia(id);
    return new BaseResponse(true, 'Đã đặt phương tiện làm ảnh đại diện', data);
  }

  // 5. Lưu ảnh sau khi Crop (Nhận 1 file)
  @Post(':id/crop')
  @RequirePermissions(Resource.BLOG, Action.UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  async saveCroppedImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Không tìm thấy dữ liệu ảnh cắt.');
    const data = await this.mediaService.saveCroppedImage(id, file);
    return new BaseResponse(true, 'Cắt ảnh thành công', data);
  }

  // 6. Thay thế file (Nhận 1 file)
  @Post(':id/replace')
  @RequirePermissions(Resource.BLOG, Action.UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  async replaceMedia(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Không có tệp tin thay thế.');
    const data = await this.mediaService.replaceMedia(id, file);
    return new BaseResponse(true, 'Thay thế phương tiện thành công', data);
  }

  // 7. Xóa hoàn toàn phương tiện (AC5)
  @Delete(':id')
  @RequirePermissions(Resource.BLOG, Action.DELETE)
  async hardDeleteMedia(@Param('id') id: string) {
    const result = await this.mediaService.hardDeleteMedia(id);
    return new BaseResponse(true, result.message);
  }
}
