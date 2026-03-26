import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ContentService, type QueryBannerDto } from './content.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { ReorderBannersDto } from './dto/reorder-banner.dto';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';

@Controller('marketing/content/banners')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  // API DÀNH CHO ADMIN

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.CREATE)
  async createBanner(@Body() dto: CreateBannerDto) {
    const data = await this.contentService.createBanner(dto);
    return new BaseResponse(true, 'Tạo banner thành công', data);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.READ)
  async getAllBanners(@Query() query: QueryBannerDto) {
    const data = await this.contentService.findAll(query);
    return new BaseResponse(true, 'Lấy danh sách banner thành công', data);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.READ)
  async getBannerDetail(@Param('id') id: string) {
    const data = await this.contentService.findOne(id);
    return new BaseResponse(true, 'Thành công', data);
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.UPDATE)
  async reorderBanners(@Body() dto: ReorderBannersDto) {
    const result = await this.contentService.reorderBanners(dto);
    return new BaseResponse(true, result.message);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.UPDATE)
  async updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    const data = await this.contentService.updateBanner(id, dto);
    return new BaseResponse(true, 'Cập nhật banner thành công', data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.BLOG, Action.DELETE)
  async softDeleteBanner(@Param('id') id: string) {
    const result = await this.contentService.softDeleteBanner(id);
    return new BaseResponse(true, result.message);
  }

  // API PUBLIC CHO FRONTEND

  @Get('public/active')
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

  @Post('public/:id/click')
  async trackBannerClick(@Param('id') id: string) {
    await this.contentService.trackClick(id);
    return new BaseResponse(true, 'Ghi nhận click thành công');
  }
}
