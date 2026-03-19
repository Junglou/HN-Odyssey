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

interface RequestUser {
  userId: string;
  email: string;
  roles: string[];
}

interface RequestWithUser extends Request {
  user: RequestUser;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  // AC11: Lấy danh sách thông báo cá nhân/theo role (Cơ chế Offline Queue)
  @Get('my-notifications')
  @RequirePermissions(Resource.NOTIFICATIONS, Action.READ)
  async getMyNotifications(
    @Req() req: RequestWithUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const { items, meta } = await this.service.getNotificationsForUser(
      req.user.userId,
      req.user.roles,
      Number(page),
      Number(limit),
    );
    return new BaseResponse(true, 'Lấy thông báo thành công', items, meta);
  }

  // AC7: Đánh dấu đã đọc & AC12: Đồng bộ thiết bị
  @Patch(':id/read')
  @RequirePermissions(Resource.NOTIFICATIONS, Action.UPDATE)
  async markAsRead(@Param('id') id: string, @Req() req: RequestWithUser) {
    const result = await this.service.markAsRead(id, req.user.userId);
    if (!result) return new BaseResponse(false, 'Không tìm thấy thông báo');
    return new BaseResponse(true, 'Đã đánh dấu đã đọc', result);
  }

  // AC7: Đánh dấu đã đọc tất cả
  @Patch('read-all')
  @RequirePermissions(Resource.NOTIFICATIONS, Action.UPDATE)
  async markAllAsRead(@Req() req: RequestWithUser) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    const result = await this.service.markAllAsRead(
      req.user.userId,
      req.user.roles,
      ip,
      userAgent,
    );
    return new BaseResponse(true, 'Đã đánh dấu đọc tất cả', result);
  }

  // Lấy số lượng chưa đọc cho Badge (AC2)
  @Get('unread-count')
  @RequirePermissions(Resource.NOTIFICATIONS, Action.READ)
  async getUnreadCount(@Req() req: RequestWithUser) {
    const count = await this.service.getUnreadCount(
      req.user.userId,
      req.user.roles,
    );
    return new BaseResponse(true, 'Lấy số lượng chưa đọc thành công', {
      count,
    });
  }

  // Lấy dữ liệu biểu đồ cho Dashboard (AC12 - US.19)
  @Get('stats/trend')
  @RequirePermissions(Resource.NOTIFICATIONS, Action.READ)
  async getTrend(): Promise<BaseResponse<NotificationTrend[]>> {
    const data = await this.service.get7DayTrend();
    return new BaseResponse(
      true,
      'Lấy thống kê xu hướng thành công',
      data as NotificationTrend[],
    );
  }
}
