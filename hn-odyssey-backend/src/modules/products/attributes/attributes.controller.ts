import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Ip,
  Headers,
} from '@nestjs/common';
import { AttributesService } from './attributes.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { ChangeActiveStatusDto } from 'src/common/dtos/change-active-status.dto';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { IUser } from 'src/common/interfaces/user.interface';

@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  // 1. TẠO MỚI
  @Post()
  @RequirePermissions(Resource.CATALOG_ATTRIBUTES, Action.CREATE)
  create(
    @Body() createAttributeDto: CreateAttributeDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.attributesService.create(
      createAttributeDto,
      user._id,
      ip,
      userAgent,
    );
  }

  // 1. DÀNH CHO PORTAL ADMIN (Cần quyền, lấy TẤT CẢ thuộc tính kể cả bị ẩn)
  @Get()
  @RequirePermissions(Resource.CATALOG_ATTRIBUTES, Action.READ)
  findAllAdmin() {
    return this.attributesService.findAll(); // Service query không điều kiện
  }

  // 2. DÀNH CHO CLIENT PUBLIC (Không cần quyền, CHỈ lấy thuộc tính đang Active)
  @Get('public/active')
  @Public()
  findAllPublic() {
    // Trong attributesService, bạn cần viết thêm hàm findAllActive()
    // hoặc truyền cờ vào findAll({ is_active: true })
    return this.attributesService.findAllActive();
  }

  // 3. CHI TIẾT
  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.attributesService.findOne(id);
  }

  // 4. CẬP NHẬT
  @Patch(':id')
  @RequirePermissions(Resource.CATALOG_ATTRIBUTES, Action.UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateAttributeDto: UpdateAttributeDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.attributesService.update(
      id,
      updateAttributeDto,
      user._id,
      ip,
      userAgent,
    );
  }

  // 4b. BẬT/TẮT TRẠNG THÁI (quyền CHANGE_STATUS)
  @Patch(':id/status')
  @RequirePermissions(Resource.CATALOG_ATTRIBUTES, Action.CHANGE_STATUS)
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeActiveStatusDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.attributesService.changeStatus(
      id,
      dto.is_active,
      user._id,
      ip,
      userAgent,
    );
  }

  // 5. XÓA
  @Delete(':id')
  @RequirePermissions(Resource.CATALOG_ATTRIBUTES, Action.DELETE)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.attributesService.remove(id, user._id, ip, userAgent);
  }
}
