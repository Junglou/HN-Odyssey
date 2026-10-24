import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import type { Request } from 'express';

interface NotificationTrend {
  _id: { day: string; type: string };
  count: number;
}

// Khớp với giá trị JwtStrategy.validate() trả về
interface RequestUser {
  _id: string;
  email: string;
  roles: string[];
  fullName?: string;
}

interface RequestWithUser extends Request {
  user: RequestUser;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  // Danh sách thông báo của người đang đăng nhập (đã lọc theo quyền)
  // ?unread=true để chỉ lấy thông báo chưa đọc
  @Get('my-notifications')
  async getMyNotifications(
    @Req() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('unread') unread?: string,
  ) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));

    const { items, meta } = await this.service.getNotificationsForUser(
      String(req.user._id),
      safePage,
      safeLimit,
      unread === 'true',
    );
    return new BaseResponse(true, 'Lấy thông báo thành công', items, meta);
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: RequestWithUser) {
    const result = await this.service.markAllAsRead(
      String(req.user._id),
      req.ip,
      req.headers['user-agent'],
    );
    return new BaseResponse(true, 'Đã đánh dấu đọc tất cả', result);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: RequestWithUser) {
    const result = await this.service.markAsRead(id, String(req.user._id));
    if (!result) return new BaseResponse(false, 'Không tìm thấy thông báo');
    return new BaseResponse(true, 'Đã đánh dấu đã đọc', result);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: RequestWithUser) {
    const count = await this.service.getUnreadCount(String(req.user._id));
    return new BaseResponse(true, 'Lấy số lượng chưa đọc thành công', {
      count,
    });
  }

  // API thống kê hệ thống VẪN BẮT BUỘC PHÂN QUYỀN
  @Get('stats/trend')
  @RequirePermissions(Resource.SYSTEM_NOTIFICATIONS, Action.READ)
  async getTrend(): Promise<BaseResponse<NotificationTrend[]>> {
    const data = await this.service.get7DayTrend();
    return new BaseResponse(
      true,
      'Lấy thống kê xu hướng thành công',
      data as NotificationTrend[],
    );
  }
}
