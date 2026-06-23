import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service'; // THÊM

@Module({
  controllers: [UploadController],
  providers: [UploadService], // THÊM
  exports: [UploadService], // THÊM
})
export class UploadModule {}
