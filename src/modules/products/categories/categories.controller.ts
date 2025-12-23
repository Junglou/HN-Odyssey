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
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateCategoryOrderDto } from './dto/update-category-order.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Public } from '../../../common/decorators/public.decorator';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('search')
  async search(@Query('q') keyword: string) {
    if (!keyword || keyword.trim() === '') {
      return [];
    }
    return this.categoriesService.search(keyword);
  }

  @Public() 
  @Get('tree-view')
  async findAll() {
    // US.69 AC1: Lấy cây danh mục (chỉ hiện cái active)
    return this.categoriesService.getTree(false);
  }

  @Public()
  @Get('details/:slug')
  async findOneBySlug(@Param('slug') slug: string) {
    // US.70: Chi tiết danh mục (cho trang Product Listing)
    return this.categoriesService.findBySlug(slug);
  }

  @Post('create')
  @Roles(Role.ADMIN)
  create(@Body() createCategoryDto: CreateCategoryDto) {
    // US.69 AC2: Tạo mới
    return this.categoriesService.create(createCategoryDto);
  }

  @Get('admin/tree-view')
  @Roles(Role.ADMIN)
  getAdminTree() {
    // US.69 AC4: Admin thấy cả danh mục ẩn (Draft/Hidden)
    return this.categoriesService.getTree(true);
  }

  @Patch('reorder')
  @Roles(Role.ADMIN)
  updateOrder(@Body() updateOrderDto: UpdateCategoryOrderDto) {
    // US.71: Kéo thả sắp xếp
    return this.categoriesService.updateOrder(updateOrderDto);
  }

  @Patch('update/:id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    // US.69 AC3: Đổi tên, di chuyển cha con
    // US.69 AC4: Ẩn/Hiện
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete('delete/:id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    // US.69 AC5: Xóa (có kiểm tra ràng buộc con cái)
    return this.categoriesService.remove(id);
  }
}
