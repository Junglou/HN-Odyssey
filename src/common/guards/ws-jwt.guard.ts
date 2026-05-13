import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

// Export Interface này ra để có thể dùng lại bên file Gateway nếu cần
export interface AuthenticatedSocket extends Socket {
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
      // Ép kiểu client về AuthenticatedSocket
      const client: AuthenticatedSocket = context
        .switchToWs()
        .getClient<AuthenticatedSocket>();

      // Lấy token và ép kiểu tường minh cho auth/query
      const auth = client.handshake.auth as { token?: string };
      const query = client.handshake.query as { token?: string };
      const token = auth.token || query.token;

      // NẾU KHÔNG CÓ TOKEN -> ĐÂY LÀ GUEST (KHÁCH VÃNG LAI)
      if (!token) {
        client.user = null; // Gán bằng null để phân biệt với người đã đăng nhập
        return true; // Cho phép kết nối
      }

      // NẾU CÓ TOKEN -> Xác thực
      const payload = await this.jwtService.verifyAsync<Record<string, any>>(
        token,
        {
          secret: this.configService.get<string>('JWT_SECRET'),
        },
      );

      // Gán thông tin user vào socket
      client.user = payload;

      return true;
    } catch (err: unknown) {
      // FIX LỖI TẠI ĐÂY: Ép kiểu an toàn (Type Narrowing)
      const errorMessage = err instanceof Error ? err.message : String(err);

      console.error('Token không hợp lệ:', errorMessage);
      throw new WsException('Unauthorized');
    }
  }
}
