import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Ip,
  Headers as HttpHeaders,
  UploadedFiles,
  UseInterceptors,
  Res,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import {
  UpdateProductDto,
  UpdateProductPriceDto,
  UpdateProductStatusDto,
} from './dto/update-product.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { Public } from '../../../common/decorators/public.decorator';
import { FilesInterceptor } from '@nestjs/platform-express';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { IUser } from 'src/common/interfaces/user.interface';
import { FilterProductDto } from './dto/filter-product.dto';
import { FilterOutput, ProductFilterService } from '../products-filter.service';
import type { ProductQueryParam } from 'src/common/interfaces/product.interface';
import { ContentService } from 'src/modules/marketing/content/content.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productFilterService: ProductFilterService,
    private readonly contentService: ContentService,
  ) {}

  // PUBLIC API (STOREFRONT)

  @Get('filters')
  // Khai báo kiểu trả về rõ ràng: Promise<FilterOutput[]>
  async getFilters(@Query() query: FilterProductDto): Promise<FilterOutput[]> {
    return this.productFilterService.getSmartFiltersForCategory(query);
  }

  @Public()
  @Get('store/list')
  findAllPublic(@Query() query: FilterProductDto) {
    if (query.categorySlug) {
      return this.productsService.findByCategory(query);
    }
    const findAllQuery = { ...query, status: 'ACTIVE' };
    return this.productsService.findAll(findAllQuery);
  }

  @Public()
  @Get('store/details/:slug')
  async findOneBySlug(@Param('slug') slug: string, @Res() res: Response) {
    try {
      const product = await this.productsService.findBySlug(slug);
      return res.status(HttpStatus.OK).json(product);
    } catch (error) {
      // Bắt lỗi 301 để Redirect
      if (error instanceof HttpException) {
        if (
          (error.getStatus() as HttpStatus) === HttpStatus.MOVED_PERMANENTLY
        ) {
          const response = error.getResponse() as { new_slug: string };
          const newSlug = response.new_slug;

          // Trả về Header Location (Quan trọng cho Google SEO)
          return res.redirect(
            HttpStatus.MOVED_PERMANENTLY,
            `/api/products/store/details/${newSlug}`,
          );
        }
        throw error;
      }
    }
  }

  @Public()
  @Get('store/related/:id')
  findRelated(@Param('id') id: string) {
    return this.productsService.findRelated(id);
  }

  // ADMIN / STAFF API (DASHBOARD)

  @Post()
  @RequirePermissions(Resource.PRODUCTS, Action.CREATE)
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.create(
      createProductDto,
      user._id,
      user.roles,
      ip,
      userAgent,
    );
  }

  @Get()
  @RequirePermissions(Resource.PRODUCTS, Action.READ)
  findAllAdmin(@Query() query: ProductQueryParam) {
    return this.productsService.findAll(query);
  }

  @Get('price-requests/pending')
  @RequirePermissions(Resource.PRODUCTS, Action.READ)
  @Roles(Role.SUPER_ADMIN)
  findPendingPriceRequests(@Query() query: ProductQueryParam) {
    return this.productsService.findPendingPriceRequests(query);
  }

  @Get(':id')
  @RequirePermissions(Resource.PRODUCTS, Action.READ)
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.update(
      id,
      updateProductDto,
      user._id,
      ip,
      userAgent,
    );
  }

  @Patch(':id/status')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  @Roles(Role.SUPER_ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() statusDto: UpdateProductStatusDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.updateStatus(
      id,
      statusDto,
      user._id,
      user.roles,
      ip,
      userAgent,
    );
  }

  // US.77: Nhân viên gửi yêu cầu đổi giá
  @Post(':id/price-request')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  requestPrice(
    @Param('id') id: string,
    @Body() dto: UpdateProductPriceDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.requestPriceUpdate(
      id,
      dto,
      user._id,
      ip,
      userAgent,
    );
  }

  // US.77: Quản lý duyệt giá
  @Patch(':id/price-approval')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  @Roles(Role.SUPER_ADMIN)
  approvePrice(
    @Param('id') id: string,
    @Body('action') action: 'approve' | 'reject',
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.approvePriceChange(
      id,
      action === 'approve',
      user._id,
      ip,
      userAgent,
    );
  }

  @Delete(':id')
  @RequirePermissions(Resource.PRODUCTS, Action.DELETE)
  @Roles(Role.SUPER_ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.remove(id, user._id, ip, userAgent);
  }

  @Post('upload')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  @UseInterceptors(
    FilesInterceptor('files', 15, {
      // Tối đa 15 file 1 lần
      // Set limit tổng ở mức cao nhất là 200MB (để Multer không chặn video)
      limits: { fileSize: 200 * 1024 * 1024 },
    }),
  )

  // async uploadFiles(
  //   @UploadedFiles()
  //   files: Array<Express.Multer.File>,
  // ) {
  //   if (!files || files.length === 0)
  //     throw new BadRequestException('Không có file nào được tải lên');

  //   const processedFiles: any[] = [];
  //   const uploadDir = path.join(process.cwd(), 'uploads/products');

  //   if (!fs.existsSync(uploadDir)) {
  //     fs.mkdirSync(uploadDir, { recursive: true });
  //   }

  //   for (const file of files) {
  //     // Xác định file này là Ảnh hay Video
  //     const isVideo = file.mimetype.startsWith('video/');

  //     // 1. KIỂM TRA DUNG LƯỢNG RIÊNG BIỆT (Ảnh 50MB, Video 200MB)
  //     const maxImageSize = 50 * 1024 * 1024; // 50MB
  //     const maxVideoSize = 200 * 1024 * 1024; // 200MB

  //     if (!isVideo && file.size > maxImageSize) {
  //       throw new BadRequestException(
  //         `Ảnh "${file.originalname}" vượt quá 50MB`,
  //       );
  //     }
  //     if (isVideo && file.size > maxVideoSize) {
  //       throw new BadRequestException(
  //         `Video "${file.originalname}" vượt quá 200MB`,
  //       );
  //     }

  //     // Tạo tên file ngẫu nhiên
  //     const filename = `prod-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  //     const ext = path.extname(file.originalname).toLowerCase();
  //     const originalPath = path.join(uploadDir, `${filename}${ext}`);

  //     // 2. PHÂN NHÁNH XỬ LÝ (ẢNH vs VIDEO)
  //     if (isVideo) {
  //       // --- XỬ LÝ VIDEO ---
  //       // Video không thể dùng Sharp để cắt. Chỉ lưu file vật lý thẳng vào ổ cứng.
  //       fs.writeFileSync(originalPath, file.buffer);

  //       processedFiles.push({
  //         originalName: file.originalname,
  //         filename: `${filename}${ext}`,
  //         path: `/uploads/products/${filename}${ext}`,
  //         thumbnail: `/uploads/products/${filename}${ext}`, // Video không cắt được thumb, dùng luôn link gốc
  //         medium: `/uploads/products/${filename}${ext}`,
  //         mimetype: file.mimetype,
  //         size: file.size,
  //         type: 'VIDEO', // Đánh dấu là VIDEO
  //       });
  //     } else {
  //       // --- XỬ LÝ ẢNH ---
  //       // 1. Lưu ảnh gốc
  //       await sharp(file.buffer).toFile(originalPath);

  //       // 2. Tạo ảnh Thumbnail (200x200)
  //       const thumbPath = path.join(uploadDir, `${filename}-thumb${ext}`);
  //       await sharp(file.buffer)
  //         .resize(200, 200, { fit: 'cover' })
  //         .toFile(thumbPath);

  //       // 3. Tạo ảnh Medium (800px width)
  //       const mediumPath = path.join(uploadDir, `${filename}-medium${ext}`);
  //       await sharp(file.buffer)
  //         .resize(800, null, { withoutEnlargement: true })
  //         .toFile(mediumPath);

  //       processedFiles.push({
  //         originalName: file.originalname,
  //         filename: `${filename}${ext}`,
  //         path: `/uploads/products/${filename}${ext}`,
  //         thumbnail: `/uploads/products/${filename}-thumb${ext}`,
  //         medium: `/uploads/products/${filename}-medium${ext}`,
  //         mimetype: file.mimetype,
  //         size: file.size,
  //         type: 'IMAGE', // Đánh dấu là IMAGE
  //       });
  //     }
  //   }

  //   return {
  //     message: 'Tải lên và xử lý file thành công',
  //     data: processedFiles,
  //   };
  // }
  @Patch(':id/tags')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  async updateTags(
    @Param('id') id: string,
    @Body() body: { tags: string[] },
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.updateTags(
      id,
      body.tags,
      user._id,
      ip,
      userAgent,
    );
  }

  @Get(':slug')
  async getDetail(@Param('slug') slug: string, @Res() res: Response) {
    try {
      const product = await this.productsService.findBySlug(slug);
      return res.status(HttpStatus.OK).json(product);
    } catch (error) {
      if (error instanceof HttpException) {
        if (
          (error.getStatus() as HttpStatus) === HttpStatus.MOVED_PERMANENTLY
        ) {
          const response = error.getResponse() as { new_slug: string };
          const newSlug = response.new_slug;

          // Set Header Location để Google Bot biết đường link mới
          return res.redirect(
            HttpStatus.MOVED_PERMANENTLY,
            `/products/${newSlug}`,
          );

          // Nếu làm SPA (React/Next), trả về JSON để FE tự push router:
          // return res.status(HttpStatus.MOVED_PERMANENTLY).json({
          //    redirect: true,
          //    new_url: `/products/${newSlug}`
          // });
        }
        throw error;
      }
    }
  }

  // AC4: Nhân viên submit Draft thành Pending
  @Patch(':id/price-request/submit')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  submitPriceDraft(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.submitPriceRequest(id, user._id, ip, userAgent);
  }

  // AC3: Quản lý duyệt/từ chối HÀNG LOẠT
  @Patch('price-requests/bulk-action')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  @Roles(Role.SUPER_ADMIN)
  bulkApprovePrice(
    @Body()
    body: {
      product_ids: string[];
      action: 'approve' | 'reject';
      reason?: string;
    },
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.bulkApprovePriceChanges(
      body.product_ids,
      body.action === 'approve',
      body.reason || '',
      user._id,
      ip,
      userAgent,
    );
  }

  @Post('upload')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  @UseInterceptors(
    FilesInterceptor('files', 15, {
      limits: { fileSize: 200 * 1024 * 1024 }, // Vẫn chặn giới hạn ở mức server Multer
    }),
  )
  async uploadFiles(@UploadedFiles() files: Array<Express.Multer.File>) {
    // Chỉ cần gọi hàm từ ContentService và truyền Options cấu hình cho Product
    return this.contentService.processAndSaveFiles(files, {
      subFolder: 'products',
      maxImageSize: 50 * 1024 * 1024, // 50MB
      maxVideoSize: 200 * 1024 * 1024, // 200MB
      generateThumbnail: true, // Product thì cần thumbnail
      generateMedium: true, // Product thì cần size vừa
    });
  }
}
