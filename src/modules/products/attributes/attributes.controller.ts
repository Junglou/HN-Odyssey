import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Ip,
  Headers,
} from '@nestjs/common';
import { AttributesService } from './attributes.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { IUser } from 'src/common/interfaces/user.interface';

@Controller('attributes')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  // 1. TẠO MỚI
  @Post()
  @RequirePermissions(Resource.ATTRIBUTES, Action.CREATE)
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

  // 2. DANH SÁCH
  @Get()
  @Public()
  findAll() {
    return this.attributesService.findAll();
  }

  // 3. CHI TIẾT
  @Get(':id')
  @RequirePermissions(Resource.ATTRIBUTES, Action.READ)
  findOne(@Param('id') id: string) {
    return this.attributesService.findOne(id);
  }

  // 4. CẬP NHẬT
  @Patch(':id')
  @RequirePermissions(Resource.ATTRIBUTES, Action.UPDATE)
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

  // 5. XÓA
  @Delete(':id')
  @Roles(Role.MANAGER, Role.SUPER_ADMIN)
  @RequirePermissions(Resource.ATTRIBUTES, Action.DELETE)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.attributesService.remove(id, user._id, ip, userAgent);
  }
}
