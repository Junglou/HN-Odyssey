import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import type { TradeInSocketPayload } from './listeners/notification.listener';

interface JwtPayload {
  sub?: string;
  userId?: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const auth = client.handshake.auth as { token?: string };
      const query = client.handshake.query as { token?: string };
      const token = auth.token || query.token;

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token);
      const userId = payload.sub || payload.userId;

      if (!userId) {
        client.disconnect();
        return;
      }

      // CHỈ join phòng cá nhân. Ai nhận thông báo nào do server tính theo
      // quyền (Role Management) tại thời điểm gửi — không phụ thuộc nội dung JWT,
      // đổi quyền có hiệu lực ngay mà không cần đăng nhập lại.
      await client.join(`user_${userId}`);

      this.logger.log(`Client connected: ${userId}`);
    } catch (error) {
      this.logger.error(
        'Socket connection error:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Gửi tới 1 phòng bất kỳ (giữ cho các nơi gọi cũ) */
  sendToRoom(room: string, event: string, data: unknown) {
    this.server.to(room).emit(event, data);
  }

  /**
   * Gửi tới nhiều người trong MỘT lần emit.
   * Socket.IO tự loại trùng: 1 client chỉ nhận đúng 1 lần dù khớp nhiều phòng.
   */
  sendToUsers(userIds: string[], event: string, data: unknown) {
    const rooms = Array.from(new Set(userIds)).map((id) => `user_${id}`);
    if (rooms.length === 0) return;
    this.server.to(rooms).emit(event, data);
  }

  @OnEvent('trade_in.status_updated', { async: true })
  handleTradeInStatusUpdated(payload: TradeInSocketPayload): void {
    this.server.emit('trade_in_status_updated', {
      requestCode: payload.requestCode,
      status: payload.status,
    });

    this.logger.log(
      `Đã broadcast cập nhật trạng thái Trade-in qua Socket: ${payload.requestCode}`,
    );
  }
}
