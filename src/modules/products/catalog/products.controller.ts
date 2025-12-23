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
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import {
  UpdateProductDto,
  UpdateProductPriceDto,
  UpdateProductStatusDto,
} from './dto/update-product.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
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

@Controller('products')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  create(
    @Body() createProductDto: CreateProductDto,
    @Req() req: RequestWithUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    //Nếu là nhân viên, cưỡng chế giá về 0
    if (
      req.user.roles.includes(Role.STAFF) &&
      !req.user.roles.includes(Role.ADMIN)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  findAllAdmin(@Query() query: any) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  // API 1: Sửa thông tin chung
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.remove(id, req.user._id, ip, userAgent);
  }

  @Post('upload')
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      // Cho phép up tối đa 10 file cùng lúc
      storage: storageConfig('products'), // Lưu vào folder 'products'
      fileFilter: fileFilter,
      limits: limits,
    }),
  )
  uploadFiles(@UploadedFiles() files: Array<Express.Multer.File>) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Không có file nào được tải lên');
    }

    // [AC2] Validate chi tiết: Chặn ảnh > 5MB (Vì limit chung đang set 50MB cho video)
    const processedFiles = files.map((file) => {
      // Logic: Nếu là ảnh mà > 5MB thì báo lỗi
      if (file.mimetype.startsWith('image/') && file.size > 5 * 1024 * 1024) {
        // Xóa file vừa up lên để không rác server
        const fs = require('fs');
        fs.unlinkSync(file.path);
        throw new BadRequestException(
          `File ảnh ${file.originalname} quá lớn (> 5MB).`,
        );
      }

      // Trả về đường dẫn tương đối để lưu vào DB
      // Ví dụ: /uploads/products/abc-xyz.jpg
      return {
        originalName: file.originalname,
        filename: file.filename,
        path: `/uploads/products/${file.filename}`,
        mimetype: file.mimetype,
        size: file.size,
      };
    });

    return {
      message: 'Tải lên thành công',
      data: processedFiles,
    };
  }

  // API 3: Gắn thẻ (Tags) cho sản phẩm
  @Patch(':id/tags')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
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
