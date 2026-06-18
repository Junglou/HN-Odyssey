import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Delete,
  Query,
  Ip,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserAgent } from '../../../common/decorators/user-agent.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import {
  storageConfig,
  fileFilter,
} from '../../../common/utils/file-upload.util';
import { ApiOperation } from '@nestjs/swagger';
import { UploadService } from 'src/modules/system/upload/upload.service';

interface ICurrentUser {
  userId?: string;
  _id?: string;
  sub?: string;
}

@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly uploadService: UploadService,
  ) {}

  private getUserId(user: ICurrentUser): string {
    const id = user.userId || user._id || user.sub;
    if (!id) {
      throw new UnauthorizedException(
        'Không tìm thấy thông tin định danh người dùng',
      );
    }
    return String(id);
  }

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

  @Patch(':id')
  async updateByUser(
    @Param('id') reviewId: string,
    @CurrentUser() user: ICurrentUser,
    @Body() dto: UpdateReviewDto,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    const userId = this.getUserId(user);
    return this.reviewsService.updateReviewByUser(
      userId,
      reviewId,
      dto,
      ip,
      userAgent,
    );
  }

  @Delete(':id')
  async deleteByUser(
    @Param('id') reviewId: string,
    @CurrentUser() user: ICurrentUser,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    const userId = this.getUserId(user);
    return this.reviewsService.deleteReviewByUser(
      userId,
      reviewId,
      ip,
      userAgent,
    );
  }

  @Post('upload-media')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: storageConfig(), // Gọi hàm rỗng để dùng memoryStorage
      fileFilter: fileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadReviewMedia(@UploadedFiles() files: Express.Multer.File[]) {
    // Đổi type về chuẩn của Express.Multer.File
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ảnh/video để tải lên');
    }

    // Đẩy song song tất cả các file lên Cloudinary vào thư mục hn-odyssey/reviews
    const uploadPromises = files.map((file) =>
      this.uploadService.uploadFile(file, 'reviews'),
    );

    const results = await Promise.all(uploadPromises);

    const processedFiles = files.map((file, index) => {
      const isImage = file.mimetype.startsWith('image/');
      return {
        url: results[index].secure_url, // Lấy link HTTPS trực tiếp từ Cloudinary
        type: isImage ? 'IMAGE' : 'VIDEO',
        thumbnail: null,
      };
    });

    return {
      success: true,
      message: 'Tải lên thành công',
      data: processedFiles,
    };
  }

  @Public()
  @Get('product/:productId')
  async findAll(
    @Param('productId') productId: string,
    @Query() query: ReviewQueryDto,
  ) {
    return this.reviewsService.findAll(productId, query);
  }

  @Post(':id/vote')
  async voteHelpful(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const userId = this.getUserId(user);
    return this.reviewsService.voteHelpful(id, userId);
  }

  @Post(':id/report')
  async report(
    @Param('id') id: string,
    @Body() dto: ReportReviewDto,
    @CurrentUser() user: ICurrentUser,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    const userId = this.getUserId(user);
    return this.reviewsService.reportReview(userId, id, dto, ip, userAgent);
  }

  @Public()
  @Get('stats/:productId')
  async getStats(@Param('productId') productId: string) {
    return this.reviewsService.getStats(productId);
  }

  @Get('eligibility/:productId')
  @ApiOperation({ summary: 'Kiểm tra quyền đánh giá sản phẩm của user' })
  async checkEligibility(
    @Param('productId') productId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const userId = this.getUserId(user);
    return this.reviewsService.checkEligibility(userId, productId);
  }
}
