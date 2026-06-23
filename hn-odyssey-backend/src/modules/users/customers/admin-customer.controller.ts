import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Delete,
  Res,
  Patch,
  BadRequestException,
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

interface IAdminUser {
  _id: string;
  email: string;
  roles: string[];
}

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CustomersAdminController {
  constructor(private readonly customersService: CustomersAdminService) {}

  // US.120 - Bulk Action: Cập nhật trạng thái hàng loạt
  @Patch('bulk/status')
  @RequirePermissions(Resource.CUSTOMERS, Action.MANAGE)
  async bulkUpdateStatus(
    @Body() dto: BulkUpdateStatusDto,
    @CurrentUser() user: IAdminUser,
  ) {
    return this.customersService.bulkUpdateStatus(
      dto.customerIds,
      dto.status,
      dto.reason || 'Cập nhật trạng thái hàng loạt',
      { id: user._id, email: user.email, roles: user.roles },
    );
  }

  // US.117 - Bulk Action: Vô hiệu hóa/Xóa mềm hàng loạt
  @Delete('bulk/delete')
  @RequirePermissions(Resource.CUSTOMERS, Action.DELETE)
  async bulkSoftDelete(
    @Body() dto: BulkDeleteDto,
    @CurrentUser() user: IAdminUser,
  ) {
    return this.customersService.bulkSoftDelete(
      dto.customerIds,
      user._id,
      dto.reason || 'Xóa mềm hàng loạt',
    );
  }

  // AC1 -> AC7: Lấy danh sách khách hàng (Phân trang, Tìm kiếm, Lọc)
  @Get()
  @RequirePermissions(Resource.CUSTOMERS, Action.READ)
  async findAll(@Query() query: AdminCustomerQueryDto) {
    return this.customersService.findAll(query);
  }

  // AC9: Xuất danh sách khách hàng ra Excel
  @Get('export/excel')
  @RequirePermissions(Resource.CUSTOMERS, Action.EXPORT)
  async exportExcel(
    @Query() query: AdminCustomerQueryDto, // Bổ sung nhận query
    @Res() res: Response,
  ) {
    // Truyền query xuống service
    return this.customersService.exportToExcel(query, res);
  }

  // US.117 - AC1: Thêm mới hồ sơ khách hàng thủ công
  @Post()
  @RequirePermissions(Resource.CUSTOMERS, Action.CREATE)
  async create(
    @Body() dto: AdminCreateCustomerDto,
    @CurrentUser() user: IAdminUser,
  ) {
    return this.customersService.createCustomer(dto, user._id);
  }

  // US.119 - AC6: Xuất lịch sử hoạt động của 1 khách hàng ra Excel
  @Get(':id/activities/export')
  @RequirePermissions(Resource.AUDIT_LOGS, Action.EXPORT)
  async exportActivities(@Param('id') id: string, @Res() res: Response) {
    return this.customersService.exportActivitiesToExcel(id, res);
  }

  // US.119 - AC1: Xem lịch sử hoạt động/đăng nhập
  @Get(':id/activities')
  @RequirePermissions(Resource.AUDIT_LOGS, Action.READ)
  async getActivities(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.customersService.getCustomerActivities(id, query);
  }

  // US.114: Xem chi tiết hồ sơ khách hàng
  @Get(':id')
  @RequirePermissions(Resource.CUSTOMERS, Action.READ)
  async getDetail(@Param('id') id: string) {
    return this.customersService.getCustomerDetail(id);
  }

  // US.117 - AC7: Đặt lại mật khẩu thủ công bởi Staff
  @Patch(':id/password')
  @RequirePermissions(Resource.CUSTOMERS, Action.MANAGE)
  async updatePassword(
    @Param('id') id: string,
    @Body() dto: AdminUpdatePasswordDto, // Sử dụng DTO ở đây
    @CurrentUser() user: IAdminUser,
  ) {
    return this.customersService.updatePasswordByAdmin(
      id,
      dto.newPassword.trim(),
      { id: user._id, email: user.email },
    );
  }

  // US.120 - AC1, AC2, AC3: Cập nhật trạng thái (Khóa/Mở/Ban)
  @Patch(':id/status')
  @RequirePermissions(Resource.CUSTOMERS, Action.MANAGE)
  async updateAccountStatus(
    @Param('id') id: string,
    @Body() body: UpdateCustomerStatusDto,
    @CurrentUser() user: IAdminUser,
  ) {
    return this.customersService.updateStatus(id, body.status, body.reason, {
      id: user._id,
      email: user.email,
      roles: user.roles,
    });
  }

  // US.120 - AC4, AC5: Quản lý quyền đánh giá
  @Patch(':id/review-access')
  @RequirePermissions(Resource.CUSTOMERS, Action.MANAGE)
  async updateReviewAccess(
    @Param('id') id: string,
    @Body('access') access: 'ALLOWED' | 'RESTRICTED',
    @Body('reason') reason: string,
    @CurrentUser() user: IAdminUser,
  ) {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException(
        'Bắt buộc phải nhập lý do/ghi chú khi thay đổi quyền hạn.',
      );
    }

    return this.customersService.toggleReviewAccess(id, access, reason, {
      id: user._id,
      email: user.email,
    });
  }

  // US.117 - AC2: Chỉnh sửa thông tin hồ sơ
  @Patch(':id')
  @RequirePermissions(Resource.CUSTOMERS, Action.MANAGE)
  async update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateCustomerDto,
    @CurrentUser() user: IAdminUser,
  ) {
    return this.customersService.updateCustomer(id, dto, user._id);
  }

  // US.117 - AC6: Xóa vĩnh viễn tài khoản (Hard delete)
  @Delete(':id/permanent')
  @RequirePermissions(Resource.CUSTOMERS, Action.DELETE)
  async deletePermanent(
    @Param('id') id: string,
    @CurrentUser() user: IAdminUser,
  ) {
    return this.customersService.hardDelete(id, user._id);
  }

  // US.117: Vô hiệu hóa tài khoản (Soft delete)
  @Delete(':id')
  @RequirePermissions(Resource.CUSTOMERS, Action.DELETE)
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() user: IAdminUser,
    @Body('reason') reason: string,
  ) {
    return this.customersService.softDelete(id, reason, user._id);
  }
}
