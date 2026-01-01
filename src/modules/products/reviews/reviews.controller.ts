import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Ip,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserAgent } from '../../../common/decorators/user-agent.decorator';
import { ReportReviewDto } from './dto/report-review.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // AC: Gửi đánh giá (User phải đăng nhập)
  // [UPDATE] Thêm Ip và UserAgent để log spam review
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateReviewDto,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    //Log xem cấu trúc user thực tế là gì
    console.log('DEBUG User from Guard:', user);

    //Lấy ID an toàn: Check cả userId (do Strategy map) và _id (nếu là raw user)
    const userId = user.userId || user._id || user.sub;

    if (!userId) {
      throw new Error('User ID not found in Request');
    }

    // userId thường đã là string rồi, không cần toString() nếu không chắc chắn
    return this.reviewsService.create(userId.toString(), dto);
  }

  @Public()
  @Get('product/:productId')
  async findAll(@Param('productId') productId: string, @Query() query) {
    return this.reviewsService.findAll(productId, query);
  }

  @Put(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  async approve(
    @Param('id') id: string,
    @Body('status') status: 'APPROVED' | 'HIDDEN',
    @CurrentUser() user: any, 
  ) {
    return this.reviewsService.approveReview(id, status);
  }

  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  async getPending() {
    return this.reviewsService.getPendingReviews();
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard) 
  async report(
    @Param('id') id: string,
    @Body() dto: ReportReviewDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.sub;
    return this.reviewsService.reportReview(userId.toString(), id, dto);
  }

  @Post('upload-media')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files'))
  async uploadReviewMedia(@UploadedFiles() files: Array<Express.Multer.File>) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ảnh/video để tải lên');
    }

    const processedFiles: any[] = []; 
    const uploadDir = path.join(process.cwd(), 'uploads/reviews');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    for (const file of files) {
      const filename = `review-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname).toLowerCase();
      const filePath = path.join(uploadDir, `${filename}${ext}`);

      //Kiểm tra loại file
      const isImage = file.mimetype.startsWith('image/');
      const isVideo = file.mimetype.startsWith('video/');

      if (isImage) {
        // Nếu là Ảnh -> Dùng Sharp resize
        await sharp(file.buffer)
          .resize(1000, null, { withoutEnlargement: true })
          .jpeg({ quality: 80, force: false })
          .toFile(filePath);

        processedFiles.push({
          url: `/uploads/reviews/${filename}${ext}`,
          type: 'IMAGE',
        });
      } else if (isVideo) {

        fs.writeFileSync(filePath, file.buffer);

        processedFiles.push({
          url: `/uploads/reviews/${filename}${ext}`,
          type: 'VIDEO',
          thumbnail: null, 
        });
      }
    }

    return {
      message: 'Upload thành công',
      data: processedFiles, 
    };
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  async voteHelpful(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reviewsService.voteHelpful(id, user._id);
  }

  @Public()
  @Get('stats/:productId')
  async getStats(@Param('productId') productId: string) {
    return this.reviewsService.getStats(productId);
  }
}
