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

// Mở rộng interface để hỗ trợ các định dạng payload khác nhau
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

    // Lấy thông tin user dựa trên interface đã định nghĩa thay vì dùng any
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

      // Kiểm tra tần suất request lệch chuẩn ueba
      const rateKey = `ueba:rate:${userId}:${currentMin}`;
      const reqCount = await this.redis.incr(rateKey);

      // Reset bộ đếm sau 60 giây
      if (reqCount === 1) {
        await this.redis.expire(rateKey, 60);
      }

      // Ngưỡng cảnh báo: 200 request mỗi phút
      if (reqCount === 200) {
        this.eventEmitter.emit(NOTIFY_EVENTS.SECURITY_ALERT, {
          severity: 'HIGH',
          message: `[Hành vi lệch chuẩn UEBA]: Phát hiện tần suất cao bất thường (${reqCount} requests/phút).`,
          user_id: userId !== 'anonymous' ? userId : undefined,
          ip: ip,
        });
      }

      // Phát hiện truy cập dữ liệu nhạy cảm hoặc tải file lớn
      // Thu hẹp phạm vi các endpoint nhạy cảm để tránh báo cáo sai từ dashboard
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
        const sensitiveKey = `ueba:sensitive:${userId}:${currentMin}`;
        const sensitiveCount = await this.redis.incr(sensitiveKey);

        if (sensitiveCount === 1) {
          await this.redis.expire(sensitiveKey, 60);
        }

        // Ngưỡng cảnh báo truy cập dữ liệu nhạy cảm: 5 lần mỗi phút
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
