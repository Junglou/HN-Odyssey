import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ContentService,
  type QueryBannerDto,
  type QueryPostDto,
} from './content.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { ReorderBannersDto } from './dto/reorder-banner.dto';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateStaticPageDto } from './dto/create-static-page.dto';
import {
  CreateMenuDto,
  UpdatePostDto,
  UpdateStaticPageDto,
} from './dto/update-content.dto';

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    roles: string[];
  };
}

@Controller('marketing/content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  // API: BLOG POSTS (US.125)

  @Post('posts')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.CREATE)
  async createPost(@Body() dto: CreatePostDto, @Req() req: RequestWithUser) {
    const data = await this.contentService.createPost(
      dto,
      req.user.userId,
      req.user.email,
    );
    return new BaseResponse(true, 'Tạo bài viết thành công', data);
  }

  @Get('posts')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.READ)
  async getAllPosts(@Query() query: QueryPostDto) {
    const data = await this.contentService.findAllPosts(query);
    return new BaseResponse(true, 'Lấy danh sách bài viết thành công', data);
  }

  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.DELETE)
  async deletePost(@Param('id') id: string, @Req() req: RequestWithUser) {
    const result = await this.contentService.softDeletePost(
      id,
      req.user.userId,
      req.user.email,
    );
    return new BaseResponse(true, result.message);
  }

  // API: STATIC PAGES (US.126)

  @Post('pages')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.CREATE) // Dùng chung quyền quản lý Nội dung
  async createPage(
    @Body() dto: CreateStaticPageDto,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.contentService.createPage(
      dto,
      req.user.userId,
      req.user.email,
    );
    return new BaseResponse(true, 'Tạo trang tĩnh thành công', data);
  }

  @Delete('pages/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.DELETE)
  async deletePage(@Param('id') id: string, @Req() req: RequestWithUser) {
    const result = await this.contentService.softDeletePage(
      id,
      req.user.userId,
      req.user.email,
    );
    return new BaseResponse(true, result.message);
  }

  // AC7 (US.125) & Mở rộng (US.126): API Xem trước (Preview Mode) cho Frontend
  @Get('public/preview/:slug')
  async previewContent(@Param('slug') slug: string) {
    // API này không dùng Guard để Frontend có thể fetch xem trước,
    // nhưng trong thực tế có thể yêu cầu 1 token preview ngắn hạn.
    // Logic sẽ fetch dữ liệu từ service dựa trên Slug thay vì ID để khớp URL.
    const data = await this.contentService.getPreviewContentBySlug(slug);
    return new BaseResponse(true, 'Lấy dữ liệu preview thành công', data);
  }

  // API UPDATE POST & PAGE (Dành cho Admin)
  @Patch('posts/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.UPDATE)
  async updatePost(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.contentService.updatePost(
      id,
      dto,
      req.user.userId,
      req.user.email,
    );
    return new BaseResponse(true, 'Cập nhật bài viết thành công', data);
  }

  @Patch('pages/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.UPDATE)
  async updatePage(
    @Param('id') id: string,
    @Body() dto: UpdateStaticPageDto,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.contentService.updatePage(
      id,
      dto,
      req.user.userId,
      req.user.email,
    );
    return new BaseResponse(true, 'Cập nhật trang tĩnh thành công', data);
  }

  // API MENU CONFIG (US.126 - AC5)
  @Post('menus')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.SYSTEM, Action.UPDATE) // Quyền cấu hình hệ thống/giao diện
  async createMenu(@Body() dto: CreateMenuDto, @Req() req: RequestWithUser) {
    const data = await this.contentService.createMenu(
      dto,
      req.user.userId,
      req.user.email,
    );
    return new BaseResponse(true, 'Tạo cấu hình Menu thành công', data);
  }

  @Get('public/menus')
  async getPublicMenus(@Query('position') position: string) {
    const data = await this.contentService.getPublicMenus(position);
    return new BaseResponse(true, 'Lấy danh sách Menu thành công', data);
  }

  // API PUBLIC FRONTEND KHÁCH HÀNG (Đọc bài viết/trang)
  @Get('public/posts/:slug')
  async getPublicPost(@Param('slug') slug: string) {
    const data = await this.contentService.getPublicPostBySlug(slug);
    return new BaseResponse(true, 'Thành công', data);
  }

  @Get('public/pages/:slug')
  async getPublicPage(@Param('slug') slug: string) {
    const data = await this.contentService.getPublicPageBySlug(slug);
    return new BaseResponse(true, 'Thành công', data);
  }

  // API DÀNH CHO BANNERS

  @Post('banners')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.CREATE)
  async createBanner(@Body() dto: CreateBannerDto) {
    const data = await this.contentService.createBanner(dto);
    return new BaseResponse(true, 'Tạo banner thành công', data);
  }

  @Get('banners')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.READ)
  async getAllBanners(@Query() query: QueryBannerDto) {
    const data = await this.contentService.findAll(query);
    return new BaseResponse(true, 'Lấy danh sách banner thành công', data);
  }

  @Get('banners/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.READ)
  async getBannerDetail(@Param('id') id: string) {
    const data = await this.contentService.findOne(id);
    return new BaseResponse(true, 'Thành công', data);
  }

  @Patch('banners/reorder')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.UPDATE)
  async reorderBanners(@Body() dto: ReorderBannersDto) {
    const result = await this.contentService.reorderBanners(dto);
    return new BaseResponse(true, result.message);
  }

  @Patch('banners/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.UPDATE)
  async updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    const data = await this.contentService.updateBanner(id, dto);
    return new BaseResponse(true, 'Cập nhật banner thành công', data);
  }

  @Delete('banners/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.DELETE)
  async softDeleteBanner(@Param('id') id: string) {
    const result = await this.contentService.softDeleteBanner(id);
    return new BaseResponse(true, result.message);
  }

  // API PUBLIC CHO FRONTEND (BANNERS)

  @Get('banners/public/active')
  async getActiveBanners(
    @Query('position') position: string,
    @Query('category_id') categoryId?: string,
  ) {
    const data = await this.contentService.getActiveBanners(
      position,
      categoryId,
    );
    return new BaseResponse(true, 'Thành công', data);
  }

  @Post('banners/public/:id/click')
  async trackBannerClick(@Param('id') id: string) {
    await this.contentService.trackClick(id);
    return new BaseResponse(true, 'Ghi nhận click thành công');
  }
}
