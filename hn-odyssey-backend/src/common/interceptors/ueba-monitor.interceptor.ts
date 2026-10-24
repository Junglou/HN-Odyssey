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
  _id?: string | { toString: () => string };
  sub?: string;
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
    let userId = 'anonymous';

    if (user) {
      if (user.userId) {
        userId = user.userId;
      } else if (user._id) {
        userId = user._id.toString();
      } else if (user.sub) {
        userId = user.sub;
      }
    }

    // Chuẩn hóa IP giống SecurityMonitorInterceptor (lấy IP đầu chuỗi proxy, bỏ ::ffff:)
    const forwardedFor = request.headers['x-forwarded-for'];
    const rawIp =
      (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) ||
      request.socket.remoteAddress ||
      'unknown';
    const ip = String(rawIp)
      .split(',')[0]
      .trim()
      .replace(/^::ffff:/, '');

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

      // Đếm theo TỪNG danh tính: user đã đăng nhập theo userId, khách vãng lai theo IP.
      // Trước đây mọi khách vãng lai dùng chung khóa 'anonymous' nên chỉ cần web có
      // chút lưu lượng là cứ mỗi phút lại phát 1 cảnh báo giả.
      const identity = userId === 'anonymous' ? `ip:${ip}` : userId;

      const rateKey = `ueba:rate:${identity}:${currentMin}`;
      const reqCount = await this.redis.incr(rateKey);
      if (reqCount === 1) {
        await this.redis.expire(rateKey, 60);
      }

      // Ngưỡng: 200 request / phút / danh tính
      if (reqCount === 200) {
        this.eventEmitter.emit(NOTIFY_EVENTS.SECURITY_ALERT, {
          severity: 'HIGH',
          message: `[UEBA] Tần suất truy cập cao bất thường: ${reqCount} request/phút.`,
          user_id: userId !== 'anonymous' ? userId : undefined,
          ip: ip,
        });
      }

      // Truy xuất dữ liệu nhạy cảm (export / download)
      const sensitivePatterns = [
        '/export',
        '/download',
        '/reports/export',
        '/portal/users/export-data',
        '/portal/revenue/download-csv',
      ];

      const isSensitive = sensitivePatterns.some((pattern) =>
        url.includes(pattern),
      );

      if (isSensitive && method === 'GET') {
        const sensitiveKey = `ueba:sensitive:${identity}:${currentMin}`;
        const sensitiveCount = await this.redis.incr(sensitiveKey);

        if (sensitiveCount === 1) {
          await this.redis.expire(sensitiveKey, 60);
        }

        if (sensitiveCount === 5) {
          this.eventEmitter.emit(NOTIFY_EVENTS.SECURITY_ALERT, {
            severity: 'CRITICAL',
            message: `[UEBA] Tải/truy xuất dữ liệu quan trọng liên tục tại ${url}.`,
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
