import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Ip,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { type ReviewQueryParam, ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
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

// 1. Định nghĩa Interface cho User trong Request
interface ICurrentUser {
  userId?: string;
  _id?: string;
  sub?: string;
  [key: string]: any;
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // Helper để lấy ID an toàn
  private getUserId(user: ICurrentUser): string {
    const id = user.userId || user._id || user.sub;
    if (!id) {
      throw new UnauthorizedException('User ID not found in token');
    }
    return String(id);
  }

  // AC: Gửi đánh giá (User phải đăng nhập)
  @Post()
  async create(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: CreateReviewDto,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    const userId = this.getUserId(user);
    return this.reviewsService.create(userId, dto, ip, userAgent);
  }

  @Public()
  @Get('product/:productId')
  async findAll(
    @Param('productId') productId: string,
    @Query() query: ReviewQueryParam,
  ) {
    return this.reviewsService.findAll(productId, query);
  }

  @Put(':id/approve')
  @Roles(Role.SUPER_ADMIN)
  async approve(
    @Param('id') id: string,
    @Body('status') status: 'APPROVED' | 'HIDDEN',
  ) {
    return this.reviewsService.approveReview(id, status);
  }

  @Get('admin/pending')
  @Roles(Role.SUPER_ADMIN)
  async getPending() {
    return this.reviewsService.getPendingReviews();
  }

  @Post(':id/report')
  async report(
    @Param('id') id: string,
    @Body() dto: ReportReviewDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const userId = this.getUserId(user);
    return this.reviewsService.reportReview(userId, id, dto);
  }

  @Post('upload-media')
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
  async voteHelpful(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const userId = this.getUserId(user);
    return this.reviewsService.voteHelpful(id, userId);
  }

  @Public()
  @Get('stats/:productId')
  async getStats(@Param('productId') productId: string) {
    return this.reviewsService.getStats(productId);
  }
}
