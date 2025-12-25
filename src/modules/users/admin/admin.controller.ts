import {
  Body,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
  Ip,
  Headers as HttpHeaders,
  Patch,
} from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { AdminService } from './admin.service';
import { QueryStaffDto } from './dto/query-staff.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // 1. TẠO MỚI
  @Post('staff')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @RequirePermissions(Resource.USERS, Action.CREATE)
  async createStaff(
    @Body() dto: CreateStaffDto,
    @Req() req,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    const createdBy = req.user.userId;
    const currentUserRole = req.user.roles;
    return this.adminService.createStaff(
      dto,
      createdBy,
      ip,
      userAgent,
      currentUserRole,
    );
  }

  // 2. DANH SÁCH
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @RequirePermissions(Resource.USERS, Action.READ)
  async getStaffList(@Query() query: QueryStaffDto) {
    return this.adminService.findAllStaff(query);
  }

  // 3. CẬP NHẬT
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @RequirePermissions(Resource.USERS, Action.UPDATE)
  async updateStaff(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @Req() req,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    const currentUserId = req.user.userId;
    const currentUserRole = req.user.roles;

    return this.adminService.updateStaff(
      id,
      dto,
      currentUserId,
      currentUserRole,
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
    @Req() req,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    const currentUserId = req.user.userId;
    return this.adminService.softDeleteStaff(id, currentUserId, ip, userAgent);
  }

  // 5. ĐỔI TRẠNG THÁI (US.56 AC2)
  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @RequirePermissions(Resource.USERS, Action.UPDATE)
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @Req() req,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.adminService.changeStatus(
      id,
      dto,
      req.user.userId,
      ip,
      userAgent,
    );
  }

  // 6. LẤY CHI TIẾT (Để phục vụ US.53 AC5 - Pre-fill form)
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @RequirePermissions(Resource.USERS, Action.READ)
  async getStaffDetail(@Param('id') id: string) {
    return this.adminService.findOneStaff(id);
  }
}
