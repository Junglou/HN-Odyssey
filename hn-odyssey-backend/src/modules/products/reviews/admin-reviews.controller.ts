import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminReviewsService } from './admin-reviews.service';
import { AdminQueryReviewDto } from './dto/admin-query-review.dto';
import { AdminConfirmActionDto } from './dto/admin-confirm-action.dto';
import { BulkActionDto } from './dto/bulk-action.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Resource, Action } from '../../../common/enums/resource.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminSendEmailDto } from 'src/modules/users/customers/dto/admin-send-email.dto';

interface IAdminUser {
  userId?: string;
  _id?: string;
  sub?: string;
}

@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminReviewsController {
  constructor(private readonly adminReviewsService: AdminReviewsService) {}

  // Helper function để lấy ID chính xác
  private getAdminId(user: IAdminUser): string {
    const id = user.userId || user._id || user.sub;
    if (!id) {
      throw new UnauthorizedException(
        'Không tìm thấy thông tin định danh Admin',
      );
    }
    return String(id);
  }

  // AC1: Hiển thị danh sách và thanh công cụ bộ lọc
  @Get()
  @RequirePermissions(Resource.REVIEWS, Action.READ)
  async getAdminList(@Query() query: AdminQueryReviewDto) {
    return this.adminReviewsService.getAdminList(query);
  }

  // AC2: Thao tác Ẩn/Hiện đánh giá nhanh trên bảng (Hide)
  @Patch(':id/toggle-hide')
  @RequirePermissions(Resource.REVIEWS, Action.APPROVE)
  async toggleHideStatus(@Param('id') id: string) {
    return this.adminReviewsService.toggleHideStatus(id);
  }

  // AC8: Ghim đánh giá nổi bật (Pin Review)
  @Patch(':id/toggle-pin')
  @RequirePermissions(Resource.REVIEWS, Action.UPDATE)
  async togglePin(@Param('id') id: string) {
    return this.adminReviewsService.togglePin(id);
  }

  // AC3, AC4, AC5: Phản hồi & Chặn tài khoản người dùng vi phạm
  @Patch(':id/confirm-action')
  @RequirePermissions(Resource.REVIEWS, Action.APPROVE)
  async confirmAction(
    @Param('id') id: string,
    @Body() dto: AdminConfirmActionDto,
    @CurrentUser() user: IAdminUser,
  ) {
    const adminId = this.getAdminId(user);
    return this.adminReviewsService.confirmAction(id, dto, adminId);
  }

  // AC5: CẬP NHẬT GHI CHÚ NỘI BỘ
  @Patch(':id/note')
  @RequirePermissions(Resource.REVIEWS, Action.UPDATE)
  async updateNote(@Param('id') id: string, @Body('note') note: string) {
    return this.adminReviewsService.updateInternalNote(id, note);
  }

  // AC7: GỬI EMAIL RIÊNG
  @Post(':id/email')
  @RequirePermissions(Resource.REVIEWS, Action.UPDATE)
  async sendEmail(@Param('id') id: string, @Body() dto: AdminSendEmailDto) {
    return this.adminReviewsService.sendPrivateEmailResponse(id, dto);
  }

  // AC6: Thao tác xử lý hàng loạt (Bulk Actions)
  @Post('bulk-actions')
  @RequirePermissions(Resource.REVIEWS, Action.DELETE)
  async bulkActions(
    @Body() dto: BulkActionDto,
    @CurrentUser() user: IAdminUser,
  ) {
    const adminId = this.getAdminId(user);
    return this.adminReviewsService.bulkActions(dto, adminId);
  }
}
