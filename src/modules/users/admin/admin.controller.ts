import {
  Body,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Ip,
  Headers as HttpHeaders,
  Patch,
} from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { AdminService } from './admin.service';
import { QueryStaffDto } from './dto/query-staff.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { IUser } from 'src/common/interfaces/user.interface';

@Controller('admin/users/staff')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // 1. TẠO MỚI
  @Post()
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions(Resource.USERS, Action.CREATE)
  async createStaff(
    @Body() dto: CreateStaffDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.adminService.createStaff(
      dto,
      user._id,
      ip,
      userAgent,
      user.roles,
    );
  }

  // 2. DANH SÁCH
  @Get()
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions(Resource.USERS, Action.READ)
  async getStaffList(@Query() query: QueryStaffDto) {
    return this.adminService.findAllStaff(query);
  }

  // 3. CẬP NHẬT
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions(Resource.USERS, Action.UPDATE)
  async updateStaff(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.adminService.updateStaff(
      id,
      dto,
      user._id,
      user.roles,
      ip,
      userAgent,
    );
  }

  // 4. XÓA MỀM
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions(Resource.USERS, Action.DELETE)
  async deleteStaff(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.adminService.softDeleteStaff(id, user._id, ip, userAgent);
  }

  // 5. ĐỔI TRẠNG THÁI (US.56 AC2)
  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions(Resource.USERS, Action.UPDATE)
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.adminService.changeStatus(id, dto, user._id, ip, userAgent);
  }

  // 6. LẤY CHI TIẾT
  @Get(':id')
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions(Resource.USERS, Action.READ)
  async getStaffDetail(@Param('id') id: string) {
    return this.adminService.findOneStaff(id);
  }
}
