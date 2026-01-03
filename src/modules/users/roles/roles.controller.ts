import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Ip,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { IUser } from 'src/common/interfaces/user.interface';
import { PERMISSION_METADATA } from 'src/common/constants/permissions-metadata.constant';

@Controller('admin/roles')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.SUPER_ADMIN)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // 1. TẠO MỚI
  @Post()
  @RequirePermissions(Resource.SYSTEM, Action.CREATE)
  create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.rolesService.create(dto, user._id, ip, userAgent);
  }

  // 2. DANH SÁCH
  @Get()
  @RequirePermissions(Resource.SYSTEM, Action.READ)
  findAll() {
    return this.rolesService.findAll();
  }

  // 3. CHI TIẾT
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  // 4. CẬP NHẬT
  @Patch(':id')
  @RequirePermissions(Resource.SYSTEM, Action.UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.rolesService.update(id, updateRoleDto, user._id, ip, userAgent);
  }

  // 5. XÓA
  @Delete(':id')
  @RequirePermissions(Resource.SYSTEM, Action.DELETE)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.rolesService.remove(id, user._id, ip, userAgent);
  }

  @Get('metadata/permissions')
  @Roles(Role.SUPER_ADMIN)
  getPermissionMetadata() {
    return {
      message: 'Lấy danh sách quyền hạn thành công',
      data: PERMISSION_METADATA,
    };
  }
}
