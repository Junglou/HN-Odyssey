import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Req,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { BaseResponse } from 'src/common/dtos/base-response.dto';

interface NotificationTrend {
  _id: {
    day: string;
    type: string;
  };
  count: number;
}

interface RequestUser {
  userId: string;
  email: string;
  roles: string[];
}

// Định nghĩa Interface để dùng chung cho Req
interface RequestWithUser extends Request {
  user: RequestUser;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // AC11: Lấy danh sách thông báo khi reconnect
  @Get('my-notifications')
  async getMyNotifications(
    @Req() req: RequestWithUser, // 2. Thay any bằng RequestWithUser để fix lỗi unsafe member
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
  async markAsRead(
    @Param('id') id: string,
    @Req() req: RequestWithUser, // 3. Fix unsafe member .user
  ) {
    const result = await this.service.markAsRead(id, req.user.userId);
    if (!result) return new BaseResponse(false, 'Không tìm thấy thông báo');
    return new BaseResponse(true, 'Đã đánh dấu đã đọc', result);
  }

  // AC7: Đánh dấu đã đọc tất cả
  @Patch('read-all')
  async markAllAsRead(@Req() req: RequestWithUser) {
    const result = await this.service.markAllAsRead(
      req.user.userId,
      req.user.roles,
    );
    return new BaseResponse(true, 'Đã đánh dấu đọc tất cả', result);
  }

  @Post('test-fire')
  testFireEvent() {
    this.eventEmitter.emit(NOTIFY_EVENTS.SECURITY_ALERT, {
      severity: 'HIGH',
      message: 'Có người đang cố đăng nhập trái phép vào tài khoản của bạn!',
    });
    return { message: 'Đã bắn sự kiện test!' };
  }

  // Lấy số lượng chưa đọc cho Badge (AC2 - US.18)
  @Get('unread-count')
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
  @Roles(Role.SUPER_ADMIN, Role.WAREHOUSE_MANAGER)
  async getTrend(): Promise<BaseResponse<NotificationTrend[]>> {
    const data = await this.service.get7DayTrend();
    return new BaseResponse(
      true,
      'Lấy thống kê xu hướng thành công',
      data as NotificationTrend[],
    );
  }
}
