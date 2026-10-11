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
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Resource, Action } from 'src/common/enums/resource.enum';
import { CustomersAdminService } from './admin-customer.service';
import { AdminCreateCustomerDto } from './dto/admin-create-customer.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { PaginationQueryDto } from 'src/common/dtos/pagination-query.dto';
import { AdminUpdateCustomerDto } from './dto/admin-update-customer.dto';
import { UpdateCustomerStatusDto } from './dto/update-status.dto';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import {
  BulkDeleteDto,
  BulkUpdateStatusDto,
} from './dto/admin-bulk-customer.dto';
import { AdminUpdatePasswordDto } from './dto/admin-update-password.dto';
import type { IUser } from 'src/common/interfaces/user.interface'; // Dùng IUser chuẩn

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CustomersAdminController {
  constructor(private readonly customersService: CustomersAdminService) {}

  @Patch('bulk/status')
  @RequirePermissions(Resource.CRM_CUSTOMERS, Action.UPDATE)
  async bulkUpdateStatus(
    @Body() dto: BulkUpdateStatusDto,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
  ) {
    return this.customersService.bulkUpdateStatus(
      dto.customerIds,
      dto.status,
      dto.reason || 'Cập nhật trạng thái hàng loạt',
      { id: String(user._id), email: user.email, roles: user.roles }, // Ép kiểu string an toàn
    );
  }

  @Delete('bulk/delete')
  @RequirePermissions(Resource.CRM_CUSTOMERS, Action.DELETE)
  async bulkSoftDelete(
    @Body() dto: BulkDeleteDto,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
  ) {
    return this.customersService.bulkSoftDelete(
      dto.customerIds,
      String(user._id),
      dto.reason || 'Xóa mềm hàng loạt',
    );
  }

  @Get()
  @RequirePermissions(Resource.CRM_CUSTOMERS, Action.READ)
  async findAll(@Query() query: AdminCustomerQueryDto) {
    return this.customersService.findAll(query);
  }

  @Get('export/excel')
  @RequirePermissions(Resource.CRM_CUSTOMERS, Action.EXPORT)
  async exportExcel(
    @Query() query: AdminCustomerQueryDto,
    @Res() res: Response,
  ) {
    return this.customersService.exportToExcel(query, res);
  }

  @Post()
  @RequirePermissions(Resource.CRM_CUSTOMERS, Action.CREATE)
  async create(
    @Body() dto: AdminCreateCustomerDto,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
  ) {
    return this.customersService.createCustomer(dto, String(user._id));
  }

  @Get(':id/activities/export')
  @RequirePermissions(Resource.SYSTEM_AUDIT, Action.EXPORT)
  async exportActivities(@Param('id') id: string, @Res() res: Response) {
    return this.customersService.exportActivitiesToExcel(id, res);
  }

  @Get(':id/activities')
  @RequirePermissions(Resource.SYSTEM_AUDIT, Action.READ)
  async getActivities(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.customersService.getCustomerActivities(id, query);
  }

  @Get(':id')
  @RequirePermissions(Resource.CRM_CUSTOMERS, Action.READ)
  async getDetail(@Param('id') id: string) {
    return this.customersService.getCustomerDetail(id);
  }

  @Patch(':id/password')
  @RequirePermissions(Resource.CRM_CUSTOMERS, Action.UPDATE)
  async updatePassword(
    @Param('id') id: string,
    @Body() dto: AdminUpdatePasswordDto,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
  ) {
    return this.customersService.updatePasswordByAdmin(
      id,
      dto.newPassword.trim(),
      { id: String(user._id), email: user.email },
    );
  }

  @Patch(':id/status')
  @RequirePermissions(Resource.CRM_CUSTOMERS, Action.UPDATE)
  async updateAccountStatus(
    @Param('id') id: string,
    @Body() body: UpdateCustomerStatusDto,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
  ) {
    return this.customersService.updateStatus(id, body.status, body.reason, {
      id: String(user._id),
      email: user.email,
      roles: user.roles,
    });
  }

  @Patch(':id/review-access')
  @RequirePermissions(Resource.CRM_CUSTOMERS, Action.UPDATE)
  async updateReviewAccess(
    @Param('id') id: string,
    @Body('access') access: 'ALLOWED' | 'RESTRICTED',
    @Body('reason') reason: string,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
  ) {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException(
        'Bắt buộc phải nhập lý do/ghi chú khi thay đổi quyền hạn.',
      );
    }

    return this.customersService.toggleReviewAccess(id, access, reason, {
      id: String(user._id),
      email: user.email,
    });
  }

  @Patch(':id')
  @RequirePermissions(Resource.CRM_CUSTOMERS, Action.UPDATE)
  async update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateCustomerDto,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
  ) {
    return this.customersService.updateCustomer(id, dto, String(user._id));
  }

  @Delete(':id/permanent')
  @RequirePermissions(Resource.CRM_CUSTOMERS, Action.DELETE)
  async deletePermanent(
    @Param('id') id: string,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
  ) {
    return this.customersService.hardDelete(id, String(user._id));
  }

  @Delete(':id')
  @RequirePermissions(Resource.CRM_CUSTOMERS, Action.DELETE)
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
    @Body('reason') reason: string,
  ) {
    return this.customersService.softDelete(id, reason, String(user._id));
  }
}
