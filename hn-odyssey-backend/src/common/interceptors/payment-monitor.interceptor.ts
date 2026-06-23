import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { Request } from 'express';

@Injectable()
export class PaymentMonitorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PaymentMonitorInterceptor.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const url = request.url;

    return next.handle().pipe(
      catchError((err: Error) => {
        if (url.includes('/payment/')) {
          void this.incrementErrorCount();
        }

        return throwError(() => err);
      }),
    );
  }

  private async incrementErrorCount() {
    try {
      const key = 'count:payment_errors';
      const count = await this.redis.incr(key);

      // Nếu là lỗi đầu tiên, set thời gian hết hạn là 10 phút (600s)
      if (count === 1) {
        await this.redis.expire(key, 600);
      }

      // Nếu số lỗi vượt quá ngưỡng 5 trong 10 phút
      if (count >= 5) {
        this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
          error_code: 'PAYMENT_FAILURE_SPIKE',
          message: `Cảnh báo: Phát hiện ${count} lỗi thanh toán liên tiếp trong 10 phút qua!`,
          severity: 'CRITICAL',
        });

        // Xóa key sau khi bắn cảnh báo để bắt đầu đợt theo dõi mới
        await this.redis.del(key);
      }
    } catch (error) {
      this.logger.error('Thất bại khi cập nhật chỉ số lỗi thanh toán:', error);
    }
  }
}
