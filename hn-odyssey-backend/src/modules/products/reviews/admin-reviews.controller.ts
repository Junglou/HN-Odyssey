import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminReviewsService } from './admin-reviews.service';
import { AdminQueryReviewDto } from './dto/admin-query-review.dto';
import {
  AdminConfirmActionDto,
  BlockCustomerDto,
} from './dto/admin-confirm-action.dto';
import { BulkReviewIdsDto } from './dto/bulk-action.dto';
import { BulkReviewAction } from 'src/common/enums/review.enum';
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

  // AC3, AC4: Phản hồi đánh giá (quyền APPROVE)
  @Patch(':id/confirm-action')
  @RequirePermissions(Resource.CRM_REVIEWS, Action.APPROVE)
  async confirmAction(
    @Param('id') id: string,
    @Body() dto: AdminConfirmActionDto,
    @CurrentUser() user: IUser, // Dùng IUser chuẩn
  ) {
    // Chặn khách sẽ XÓA review → không cho đi qua quyền APPROVE nữa
    if (dto.block_customer) {
      throw new ForbiddenException(
        'Chặn khách hàng phải dùng chức năng Block riêng (yêu cầu quyền xóa đánh giá).',
      );
    }
    return this.adminReviewsService.confirmAction(id, dto, String(user._id));
  }

  // AC5: Chặn quyền đánh giá của khách + XÓA review vi phạm (quyền DELETE)
  @Patch(':id/block-customer')
  @RequirePermissions(Resource.CRM_REVIEWS, Action.DELETE)
  async blockCustomer(
    @Param('id') id: string,
    @Body() dto: BlockCustomerDto,
    @CurrentUser() user: IUser,
  ) {
    // Tái sử dụng nguyên logic chặn có sẵn trong service (transaction, email, audit log)
    return this.adminReviewsService.confirmAction(
      id,
      {
        block_customer: true,
        block_reason: dto.block_reason,
        block_reason_other: dto.block_reason_other,
      },
      String(user._id),
    );
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

  // AC6: Thao tác hàng loạt — tách route theo đúng quyền của từng hành động
  // Ẩn hàng loạt: quyền UNPUBLISH (giống route :id/hide)
  @Post('bulk/hide')
  @RequirePermissions(Resource.CRM_REVIEWS, Action.UNPUBLISH)
  async bulkHide(@Body() dto: BulkReviewIdsDto, @CurrentUser() user: IUser) {
    return this.adminReviewsService.bulkActions(
      { review_ids: dto.review_ids, action: BulkReviewAction.HIDE },
      String(user._id),
    );
  }

  // Hiện lại hàng loạt: quyền PUBLISH (giống route :id/show)
  @Post('bulk/unhide')
  @RequirePermissions(Resource.CRM_REVIEWS, Action.PUBLISH)
  async bulkUnhide(@Body() dto: BulkReviewIdsDto, @CurrentUser() user: IUser) {
    return this.adminReviewsService.bulkActions(
      { review_ids: dto.review_ids, action: BulkReviewAction.UNHIDE },
      String(user._id),
    );
  }

  // Xóa hàng loạt: quyền DELETE
  @Post('bulk/delete')
  @RequirePermissions(Resource.CRM_REVIEWS, Action.DELETE)
  async bulkDelete(@Body() dto: BulkReviewIdsDto, @CurrentUser() user: IUser) {
    return this.adminReviewsService.bulkActions(
      { review_ids: dto.review_ids, action: BulkReviewAction.DELETE },
      String(user._id),
    );
  }
}
