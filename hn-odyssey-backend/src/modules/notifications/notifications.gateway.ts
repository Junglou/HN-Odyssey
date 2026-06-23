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

// Định nghĩa Interface cho Payload để tránh dùng 'any'
interface JwtPayload {
  sub?: string;
  userId?: string;
  roles: string[];
  warehouseId?: string;
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
      // 1. Trích xuất và kiểm tra Token (Fix lỗi unsafe-argument)
      const authHeader = client.handshake.auth.token as string | undefined;
      const queryToken = client.handshake.query.token as string | undefined;
      const token = authHeader || queryToken;

      if (!token) {
        client.disconnect();
        return;
      }

      // 2. Xác thực với kiểu dữ liệu rõ ràng (Fix lỗi unsafe-member-access)
      const payload = this.jwtService.verify<JwtPayload>(token);

      const userId = payload.sub || payload.userId;
      const roles = payload.roles || [];
      const warehouseId = payload.warehouseId;

      if (!userId) {
        client.disconnect();
        return;
      }

      // 3. Thực hiện Join Room với await (Fix lỗi no-floating-promises)
      // AC12: Join room cá nhân
      await client.join(`user_${userId}`);

      // AC10: Join room theo Role và Khu vực
      if (Array.isArray(roles)) {
        for (const role of roles) {
          await client.join(`role_${role}`);
          if (warehouseId) {
            await client.join(`role_${role}_area_${warehouseId}`);
          }
        }
      }

      this.logger.log(
        `Client connected: ${userId} joined rooms: ${Array.from(client.rooms).join(', ')}`, // Fix lỗi restrict-template-expressions
      );
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

  // AC8: Gửi tin nhắn tới room cụ thể
  sendToRoom(room: string, event: string, data: unknown) {
    this.server.to(room).emit(event, data);
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
