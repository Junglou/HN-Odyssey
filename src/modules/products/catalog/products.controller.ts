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
  Res,
  HttpStatus,
  HttpException,
  BadRequestException,
  Request,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import {
  UpdateProductDto,
  UpdateProductPriceDto,
  UpdateProductStatusDto,
} from './dto/update-product.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { IUser } from 'src/common/interfaces/user.interface';
import { FilterProductDto } from './dto/filter-product.dto';
import { FilterOutput, ProductFilterService } from '../products-filter.service';
import type { ProductQueryParam } from 'src/common/interfaces/product.interface';
import { ApiOperation } from '@nestjs/swagger';
import { AlgoliaService } from 'src/modules/search/algolia.service';
import { ProductStatus } from 'src/common/enums/product-status.enum';

interface RequestWithOptionalUser extends ExpressRequest {
  user?: {
    _id?: string;
    id?: string;
  };
}

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productFilterService: ProductFilterService,
    private readonly algoliaService: AlgoliaService,
  ) {}

  // API chạy tạm để đồng bộ Algolia
  @Get('trigger-algolia-sync')
  async triggerAlgoliaSync() {
    return this.productsService.bulkSyncToAlgolia();
  }

  // PUBLIC API (STOREFRONT)
  @Public()
  @Get('filters')
  async getFilters(
    @Query() query: FilterProductDto,
    @Request() req: RequestWithOptionalUser,
  ): Promise<FilterOutput[]> {
    const userId = req.user?._id || req.user?.id;
    return this.productFilterService.getSmartFiltersForCategory(query, userId);
  }

  @Public()
  @Get('store/list')
  findAllPublic(@Query() query: FilterProductDto) {
    console.log('Dữ liệu Controller nhận được:', query);
    // Bỏ vòng lặp if rườm rà, dùng thẳng findByCategory cho mọi request Storefront
    // vì findByCategory đã bao hàm cả xử lý chữ "all", phân trang, sort và filter.
    return this.productsService.findByCategory(query);
  }

  @Public()
  @Get('store/details/:slug')
  async findOneBySlug(@Param('slug') slug: string, @Res() res: Response) {
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
  findPendingPriceRequests(@Query() query: ProductQueryParam) {
    return this.productsService.findPendingPriceRequests(query);
  }

  @Patch('bulk/status')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
  bulkUpdateStatus(
    @Body() body: { product_ids: string[]; status: ProductStatus },
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.bulkUpdateStatus(
      body.product_ids,
      body.status,
      user._id,
      user.roles,
      ip,
      userAgent,
    );
  }

  @Delete('bulk/delete')
  @RequirePermissions(Resource.PRODUCTS, Action.DELETE)
  bulkRemove(
    @Body() body: { product_ids: string[] },
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.bulkRemove(
      body.product_ids,
      user._id,
      ip,
      userAgent,
    );
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
  approvePrice(
    @Param('id') id: string,
    @Body('action') action: 'approve' | 'reject',
    @Body('sku') sku: string, // Nhận mã sku từ Frontend
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.approvePriceChange(
      id,
      sku,
      action === 'approve',
      user._id,
      ip,
      userAgent,
    );
  }

  @Delete(':id')
  @RequirePermissions(Resource.PRODUCTS, Action.DELETE)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.remove(id, user._id, ip, userAgent);
  }

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
          return res.redirect(
            HttpStatus.MOVED_PERMANENTLY,
            `/products/${newSlug}`,
          );
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
    @Body('sku') sku: string, // Nhận mã sku từ Frontend
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.productsService.submitPriceRequest(
      id,
      sku,
      user._id,
      ip,
      userAgent,
    );
  }

  // AC3: Quản lý duyệt/từ chối HÀNG LOẠT
  @Patch('price-requests/bulk-action')
  @RequirePermissions(Resource.PRODUCTS, Action.UPDATE)
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

  // INTERNAL API CHO AI AGENT (n8n) SỬ DỤNG
  @Get('internal/chatbot/search')
  @Public()
  @ApiOperation({ summary: 'API nội bộ cho Chatbot tìm kiếm sản phẩm' })
  async chatbotSearchProduct(@Query('keyword') keyword: string) {
    const cleanKeyword = keyword
      ? keyword.replace(/['"]/g, '').trim()
      : undefined;

    if (!cleanKeyword) {
      throw new BadRequestException('Vui lòng cung cấp keyword tìm kiếm');
    }

    const products = await this.productsService.searchForChatbot(cleanKeyword);

    if (!products || products.length === 0) {
      return { found: false, message: 'Không tìm thấy sản phẩm nào.' };
    }

    const productsData = products.map((p) => {
      let options = 'Sản phẩm đơn (Không phân loại)';

      if (p.has_variants && p.specs && p.specs.length > 0) {
        options = p.specs
          .map((spec) => `${spec.name}: ${spec.values.join(', ')}`)
          .join(' | ');
      }

      return {
        name: p.name,
        price: p.price,
        sale_price: p.sale_price,
        stock: p.stock,
        available_options: options,
        url: `https://your-domain.com/products/${p.slug}`,
      };
    });

    return { found: true, products: productsData };
  }

  @Get('trigger-algolia-setup')
  @RequirePermissions(Resource.SYSTEM, Action.UPDATE)
  async triggerAlgoliaSetup() {
    return this.algoliaService.setupAlgoliaIndicesAndReplicas();
  }
}
