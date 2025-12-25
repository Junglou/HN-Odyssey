import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  Ip,
  Headers as HttpHeaders,
  BadRequestException,
  UploadedFiles,
  UseInterceptors,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import {
  UpdateProductDto,
  UpdateProductPriceDto,
  UpdateProductStatusDto,
} from './dto/update-product.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { Public } from '../../../common/decorators/public.decorator';
import type { RequestWithUser } from '../../../common/interfaces/request-with-user.interface';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  storageConfig,
  fileFilter,
  limits,
} from '../../../common/utils/file-upload.util';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // PUBLIC API (STOREFRONT)

  @Public()
  @Get('store/list')
  findAllPublic(@Query() query: any) {
    // Override: Khách chỉ xem được hàng ACTIVE
    query.status = 'ACTIVE';
    return this.productsService.findAll(query);
  }

  @Public()
  @Get('store/details/:slug')
  findOneBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  // ADMIN / STAFF API (DASHBOARD)

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermissions(Resource.PRODUCTS, Action.CREATE)
  create(
    @Body() createProductDto: CreateProductDto,
    @Req() req: RequestWithUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    //Nếu là nhân viên, cưỡng chế giá về 0
    if (
      req.user.roles.includes(Role.STAFF) &&
      !req.user.roles.includes(Role.MANAGER) &&
      !req.user.roles.includes(Role.SUPER_ADMIN)
    ) {
      createProductDto.price = 0;
      createProductDto.sale_price = 0;
      if (createProductDto.variants) {
        createProductDto.variants.forEach((v) => {
          v.price = 0;
          v.sale_price = 0;
        });
      }
    }

    return this.productsService.create(
      createProductDto,
      req.user._id,
      ip,
      userAgent,
    );
  }

  @Get()
  @RequirePermissions(Resource.PRODUCTS, Action.READ)
  findAllAdmin(@Query() query: any) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(Resource.PRODUCTS, Action.READ)
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  // API 1: Sửa thông tin chung
  @Patch(':id')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Req() req: RequestWithUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.update(
      id,
      updateProductDto,
      req.user._id,
      ip,
      userAgent,
    );
  }

  // API 2: Cập nhật Trạng thái
  @Patch(':id/status')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  @Roles(Role.MANAGER, Role.SUPER_ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() statusDto: UpdateProductStatusDto,
    @Req() req: RequestWithUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.updateStatus(
      id,
      statusDto,
      req.user._id,
      req.user.roles as Role[],
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
    @Req() req: RequestWithUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.requestPriceUpdate(
      id,
      dto,
      (req.user as any).userId ||
        (req.user as any)._id ||
        (req.user as any).sub,
      ip,
      userAgent,
    );
  }

  // US.77: Quản lý duyệt giá
  @Patch(':id/price-approval')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  @Roles(Role.MANAGER, Role.SUPER_ADMIN)
  approvePrice(
    @Param('id') id: string,
    @Body('action') action: 'approve' | 'reject',
    @Req() req: RequestWithUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.approvePriceChange(
      id,
      action === 'approve',
      req.user._id,
      ip,
      userAgent,
    );
  }

  @Delete(':id')
  @RequirePermissions(Resource.PRODUCTS, Action.DELETE)
  @Roles(Role.MANAGER, Role.SUPER_ADMIN)
  remove(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.remove(id, req.user._id, ip, userAgent);
  }

  @Post('upload')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: storageConfig('products'),
      fileFilter: fileFilter,
      limits: limits,
    }),
  )
  uploadFiles(
    @UploadedFiles(
      // [TỐI ƯU] Sử dụng Pipe để validate ngay lập tức
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp)$/, // Chỉ chấp nhận ảnh
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 5, // Tối đa 5MB (AC2)
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    files: Array<Express.Multer.File>,
  ) {
    // Không cần check thủ công file.size hay fs.unlinkSync nữa
    // Nếu code chạy vào đến đây, tức là toàn bộ file đều hợp lệ.

    const processedFiles = files.map((file) => ({
      originalName: file.originalname,
      filename: file.filename,
      path: `/uploads/products/${file.filename}`,
      mimetype: file.mimetype,
      size: file.size,
    }));

    return {
      message: 'Tải lên thành công',
      data: processedFiles,
    };
  }

  // API 3: Gắn thẻ (Tags) cho sản phẩm
  @Patch(':id/tags')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  async updateTags(
    @Param('id') id: string,
    @Body() body: { tags: string[] }, // Lưu ý: Nhận Body là Object chứa mảng tags
    @Req() req: RequestWithUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    // Gọi sang service
    return this.productsService.updateTags(
      id,
      body.tags,
      req.user._id,
      ip,
      userAgent,
    );
  }
}
