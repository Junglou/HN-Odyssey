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
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { IUser } from 'src/common/interfaces/user.interface';

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
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.categoriesService.create(
      createCategoryDto,
      user._id,
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
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.categoriesService.updateOrder(
      updateOrderDto,
      user._id,
      ip,
      userAgent,
    );
  }

  @Patch('update/:id')
  @RequirePermissions(Resource.CATEGORIES, Action.UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.categoriesService.update(
      id,
      updateCategoryDto,
      user._id,
      ip,
      userAgent,
    );
  }

  @Delete('delete/:id')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions(Resource.CATEGORIES, Action.DELETE)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.categoriesService.remove(id, user._id, ip, userAgent);
  }
}
