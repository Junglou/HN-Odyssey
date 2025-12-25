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
  Headers,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateCategoryOrderDto } from './dto/update-category-order.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('search')
  @Public()
  async search(@Query('q') keyword: string) {
    if (!keyword || keyword.trim() === '') {
      return [];
    }
    return this.categoriesService.search(keyword);
  }

  @Public()
  @Get('tree-view')
  async findAll() {
    return this.categoriesService.getTree(false);
  }

  @Public()
  @Get('details/:slug')
  async findOneBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  //ADMIN API

  @Post('create')
  @RequirePermissions(Resource.CATEGORIES, Action.CREATE)
  create(
    @Body() createCategoryDto: CreateCategoryDto,
    @Req() req,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.categoriesService.create(
      createCategoryDto,
      req.user.userId,
      ip,
      userAgent,
    );
  }

  @Get('admin/tree-view')
  @RequirePermissions(Resource.CATEGORIES, Action.READ)
  getAdminTree() {
    return this.categoriesService.getTree(true);
  }

  @Patch('reorder')
  @RequirePermissions(Resource.CATEGORIES, Action.UPDATE)
  updateOrder(
    @Body() updateOrderDto: UpdateCategoryOrderDto,
    @Req() req,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.categoriesService.updateOrder(
      updateOrderDto,
      req.user.userId,
      ip,
      userAgent,
    );
  }

  @Patch('update/:id')
  @RequirePermissions(Resource.CATEGORIES, Action.UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Req() req,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.categoriesService.update(
      id,
      updateCategoryDto,
      req.user.userId,
      ip,
      userAgent,
    );
  }

  @Delete('delete/:id')
  @Roles(Role.MANAGER, Role.SUPER_ADMIN)
  @RequirePermissions(Resource.CATEGORIES, Action.DELETE)
  remove(
    @Param('id') id: string,
    @Req() req,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.categoriesService.remove(id, req.user.userId, ip, userAgent);
  }
}
