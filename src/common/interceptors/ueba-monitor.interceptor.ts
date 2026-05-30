import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Request } from 'express';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';

interface RequestUser {
  userId?: string;
  roles?: string[];
}

interface AuthenticatedRequest extends Request {
  user?: RequestUser;
}

@Injectable()
export class UebaMonitorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(UebaMonitorInterceptor.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const url = request.url;
    const method = request.method;
    const user = request.user;

    // Nếu chưa đăng nhập thì gán là anonymous
    const userId = user?.userId || 'anonymous';

    const forwardedFor = request.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) ||
      request.socket.remoteAddress ||
      'unknown';

    // Đẩy task đếm tần suất vào background, không dùng await để tránh làm chậm response
    void this.monitorBehavior(userId, ip, url, method);

    return next.handle();
  }

  private async monitorBehavior(
    userId: string,
    ip: string,
    url: string,
    method: string,
  ) {
    try {
      const currentMin = new Date().getMinutes();

      // [AC11] KIỂM TRA TẦN SUẤT REQUEST LỆCH CHUẨN (UEBA)

      const rateKey = `ueba:rate:${userId}:${currentMin}`;
      const reqCount = await this.redis.incr(rateKey);

      // Reset bộ đếm sau 60 giây
      if (reqCount === 1) {
        await this.redis.expire(rateKey, 60);
      }

      // Ngưỡng cảnh báo: 200 request / 1 phút
      if (reqCount === 200) {
        this.eventEmitter.emit(NOTIFY_EVENTS.SECURITY_ALERT, {
          severity: 'HIGH',
          message: `[Hành vi lệch chuẩn UEBA]: Phát hiện tần suất cao bất thường (${reqCount} requests/phút).`,
          user_id: userId !== 'anonymous' ? userId : undefined,
          ip: ip,
        });
      }

      // [AC12] PHÁT HIỆN TRUY CẬP DỮ LIỆU NHẠY CẢM / TẢI FILE LỚN

      const sensitivePatterns = [
        '/export',
        '/download',
        '/reports',
        '/portal/users',
        '/portal/revenue',
      ];
      const isSensitive = sensitivePatterns.some((pattern) =>
        url.includes(pattern),
      );

      if (isSensitive && method === 'GET') {
        const sensitiveKey = `ueba:sensitive:${userId}:${currentMin}`;
        const sensitiveCount = await this.redis.incr(sensitiveKey);

        if (sensitiveCount === 1) {
          await this.redis.expire(sensitiveKey, 60);
        }

        // Ngưỡng cảnh báo truy cập dữ liệu nhạy cảm: 5 lần / 1 phút
        if (sensitiveCount === 5) {
          this.eventEmitter.emit(NOTIFY_EVENTS.SECURITY_ALERT, {
            severity: 'CRITICAL',
            message: `[Truy cập nhạy cảm]: Tải/Truy xuất lượng lớn dữ liệu quan trọng liên tục tại đường dẫn ${url}.`,
            user_id: userId !== 'anonymous' ? userId : undefined,
            ip: ip,
          });
        }
      }
    } catch (error) {
      this.logger.error('Lỗi hệ thống khi giám sát hành vi UEBA:', error);
    }
  }
}
