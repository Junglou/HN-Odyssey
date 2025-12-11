import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AdminService } from './admin.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // BẮT BUỘC: Chỉ ADMIN mới được tạo user nội bộ
export class AdminController {
  constructor(private readonly adminService: AdminService) {}
  // API TẠO STAFF/ADMIN (US.123)
  @Post('staff')
  async createStaff(@Body() dto: CreateStaffDto, @Req() req) {
    // Logic hash mật khẩu và tạo user
    // DTO phải có trường role hoặc type (để phân loại Staff/Admin)
    const createdBy = req.user.sub;
    return this.adminService.createStaff(dto, createdBy);
  }
}
