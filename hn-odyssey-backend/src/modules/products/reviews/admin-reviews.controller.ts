import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
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
import type { IUser } from 'src/common/interfaces/user.interface'; // Dùng chuẩn

@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminReviewsController {
  constructor(private readonly adminReviewsService: AdminReviewsService) {}

  // AC1: Hiển thị danh sách
  @Get()
  @RequirePermissions(Resource.CRM_REVIEWS, Action.READ)
  async getAdminList(@Query() query: AdminQueryReviewDto) {
    return this.adminReviewsService.getAdminList(query);
  }

  @Patch(':id/hide')
  @RequirePermissions(Resource.CRM_REVIEWS, Action.UNPUBLISH)
  async hideReviewStatus(@Param('id') id: string) {
    return this.adminReviewsService.hideReview(id);
  }

  @Patch(':id/show')
  @RequirePermissions(Resource.CRM_REVIEWS, Action.PUBLISH)
  async showReviewStatus(@Param('id') id: string) {
    return this.adminReviewsService.showReview(id);
  }

  // AC8: Ghim đánh giá nổi bật
  @Patch(':id/toggle-pin')
  @RequirePermissions(Resource.CRM_REVIEWS, Action.UPDATE)
  async togglePin(@Param('id') id: string) {
    return this.adminReviewsService.togglePin(id);
  }

  // AC3, AC4, AC5: Phản hồi & Chặn tài khoản
  @Patch(':id/confirm-action')
  @RequirePermissions(Resource.CRM_REVIEWS, Action.APPROVE)
  async confirmAction(
    @Param('id') id: string,
    @Body() dto: AdminConfirmActionDto,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
  ) {
    return this.adminReviewsService.confirmAction(id, dto, String(user._id));
  }

  // AC5: CẬP NHẬT GHI CHÚ NỘI BỘ
  @Patch(':id/note')
  @RequirePermissions(Resource.CRM_REVIEWS, Action.UPDATE)
  async updateNote(@Param('id') id: string, @Body('note') note: string) {
    return this.adminReviewsService.updateInternalNote(id, note);
  }

  // AC7: GỬI EMAIL RIÊNG CHO KHÁCH TỪ REVIEW NÀY
  @Post(':id/email')
  @RequirePermissions(Resource.CRM_REVIEWS, Action.REPLY)
  async sendEmail(@Param('id') id: string, @Body() dto: AdminSendEmailDto) {
    return this.adminReviewsService.sendPrivateEmailResponse(id, dto);
  }

  // AC6: Thao tác xử lý hàng loạt
  @Post('bulk-actions')
  @RequirePermissions(Resource.CRM_REVIEWS, Action.DELETE)
  async bulkActions(
    @Body() dto: BulkActionDto,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
  ) {
    return this.adminReviewsService.bulkActions(dto, String(user._id));
  }
}
