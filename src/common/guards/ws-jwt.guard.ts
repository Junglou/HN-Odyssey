import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

// Định nghĩa Interface để mở rộng thuộc tính .user cho Socket
interface AuthenticatedSocket extends Socket {
  user?: any;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // Ép kiểu client về AuthenticatedSocket thay vì để any
      const client: AuthenticatedSocket = context
        .switchToWs()
        .getClient<AuthenticatedSocket>();

      // Lấy token và ép kiểu tường minh cho auth/query để tránh lỗi unsafe member access
      const auth = client.handshake.auth as { token?: string };
      const query = client.handshake.query as { token?: string };

      const token = auth.token || query.token;

      if (!token) {
        throw new WsException('Unauthorized');
      }

      // Xác thực token và gán kiểu cho payload trả về
      const payload = await this.jwtService.verifyAsync<Record<string, any>>(
        token,
        {
          secret: this.configService.get<string>('JWT_SECRET'),
        },
      );

      // Gán thông tin user vào socket
      client.user = payload;

      return true;
    } catch (err) {
      // Log lỗi nếu cần thiết để debug
      console.error('WsJwtGuard Unauthorized:', err);
      throw new WsException('Unauthorized');
    }
  }
}
