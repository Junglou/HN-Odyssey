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
  UseGuards,
} from '@nestjs/common';
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
import { BulkChangeStatusDto, BulkDeleteDto } from './dto/bulk-action.dto';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('admin/users/staff')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // 1. TẠO MỚI
  @Post()
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
  @RequirePermissions(Resource.USERS, Action.READ)
  async getStaffList(@Query() query: QueryStaffDto) {
    return this.adminService.findAllStaff(query);
  }

  // --- [SỬA LỖI] ĐƯA CÁC API TĨNH (METADATA, BULK) LÊN TRÊN CÙNG ---

  @Get('metadata/departments')
  @RequirePermissions(Resource.USERS, Action.READ)
  getDepartments() {
    return {
      message: 'Lấy danh sách phòng ban thành công',
      data: this.adminService.getDepartmentOptions(),
    };
  }

  @Patch('bulk/status')
  @RequirePermissions(Resource.USERS, Action.UPDATE)
  async bulkChangeStatus(
    @Body() dto: BulkChangeStatusDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.adminService.bulkChangeStatus(dto, user._id, ip, userAgent);
  }

  @Post('bulk/delete')
  @RequirePermissions(Resource.USERS, Action.DELETE)
  async bulkDeleteStaff(
    @Body() dto: BulkDeleteDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.adminService.bulkSoftDelete(dto, user._id, ip, userAgent);
  }

  // --- BẮT ĐẦU CÁC API ĐỘNG CÓ CHỨA PARAM (:id) Ở DƯỚI CÙNG ---

  // 3. CẬP NHẬT
  @Patch(':id')
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

  // 4. XÓA MỀM (SINGLE)
  @Delete(':id')
  @RequirePermissions(Resource.USERS, Action.DELETE)
  async deleteStaff(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @HttpHeaders('user-agent') userAgent: string,
  ) {
    return this.adminService.softDeleteStaff(id, user._id, ip, userAgent);
  }

  // 5. ĐỔI TRẠNG THÁI (SINGLE)
  @Patch(':id/status')
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
  @RequirePermissions(Resource.USERS, Action.READ)
  async getStaffDetail(@Param('id') id: string) {
    return this.adminService.findOneStaff(id);
  }
}
