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
  UseGuards,
  Patch,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ReviewsService } from './reviews.service';
import {
  CreateCustomerReplyDto,
  CreateReviewDto,
} from './dto/create-review.dto';
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
import type { IUser } from 'src/common/interfaces/user.interface'; // Dùng chuẩn

@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly uploadService: UploadService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(String(user._id), dto);
  }

  @Patch(':id')
  async updateByUser(
    @Param('id') reviewId: string,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
    @Body() dto: UpdateReviewDto,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    return this.reviewsService.updateReviewByUser(
      String(user._id),
      reviewId,
      dto,
      ip,
      userAgent,
    );
  }

  @Delete(':id')
  async deleteByUser(
    @Param('id') reviewId: string,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    return this.reviewsService.deleteReviewByUser(
      String(user._id),
      reviewId,
      ip,
      userAgent,
    );
  }

  @Post('upload-media')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: storageConfig(),
      fileFilter: fileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadReviewMedia(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ảnh/video để tải lên');
    }

    const uploadPromises = files.map((file) =>
      this.uploadService.uploadFile(file, 'reviews'),
    );
    const results = await Promise.all(uploadPromises);

    const processedFiles = files.map((file, index) => {
      const isImage = file.mimetype.startsWith('image/');
      return {
        url: results[index].secure_url,
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
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
  ) {
    return this.reviewsService.voteHelpful(id, String(user._id));
  }

  @Post(':id/report')
  async report(
    @Param('id') id: string,
    @Body() dto: ReportReviewDto,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    return this.reviewsService.reportReview(
      String(user._id),
      id,
      dto,
      ip,
      userAgent,
    );
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
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
  ) {
    return this.reviewsService.checkEligibility(String(user._id), productId);
  }

  @Post(':id/reply')
  async replyToReview(
    @Param('id') reviewId: string,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
    @Body() dto: CreateCustomerReplyDto,
  ) {
    return this.reviewsService.replyToReview(String(user._id), reviewId, dto);
  }
}
