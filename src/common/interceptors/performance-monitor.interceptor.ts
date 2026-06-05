import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as os from 'os';
import {
  SystemMetric,
  SystemMetricDocument,
} from '../../modules/system/monitoring/schemas/system-metric.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NOTIFY_EVENTS } from '../constants/notification-events.constant';

// 1. ĐỊNH NGHĨA INTERFACE ĐỂ KHỬ HOÀN TOÀN 'ANY' TỪ NESTJS
interface IHttpRequest {
  url: string;
  method: string;
}

interface IHttpResponse {
  statusCode: number;
}

@Injectable()
export class PerformanceMonitorInterceptor implements NestInterceptor {
  private readonly logger = new Logger('PerformanceMonitor');
  private readonly SLOW_THRESHOLD = 2000; // AC2: Ngưỡng 2 giây

  constructor(
    @InjectModel(SystemMetric.name)
    private readonly metricModel: Model<SystemMetricDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // 2. ÉP KIỂU AN TOÀN CHO REQUEST VÀ RESPONSE
    const req = context.switchToHttp().getRequest<IHttpRequest>();
    const res = context.switchToHttp().getResponse<IHttpResponse>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.logMetric(req, res.statusCode, startTime),
        error: (err: unknown) => {
          const status = (err as { status?: number }).status || 500;
          this.logMetric(req, status, startTime);
        },
      }),
    );
  }

  // 3. KHAI BÁO KIỂU IHttpRequest THAY VÌ 'any'
  private logMetric(req: IHttpRequest, statusCode: number, startTime: number) {
    const duration = Date.now() - startTime;
    const isSlow = duration > this.SLOW_THRESHOLD;

    // AC4: Đo lường tài nguyên CPU & RAM
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramUsagePercent = ((totalMem - freeMem) / totalMem) * 100;

    const cpuLoad = os.loadavg()[0]; // Load trung bình 1 phút
    const cpuUsagePercent = (cpuLoad / os.cpus().length) * 100;

    // [BỔ SUNG 4]: LOGIC CẢNH BÁO TÀI NGUYÊN (US2 - AC4)
    // if (ramUsagePercent > 90 || cpuUsagePercent > 90) {
    //   this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
    //     severity: 'CRITICAL',
    //     error_code: 'SYS_RESOURCE_OVERLOAD',
    //     message: `Máy chủ đang quá tải! CPU: ${cpuUsagePercent.toFixed(1)}%, RAM: ${ramUsagePercent.toFixed(1)}%. Có nguy cơ sập hệ thống.`,
    //   });
    //   this.logger.error(
    //     `[CẢNH BÁO] Tài nguyên cạn kiệt! CPU: ${cpuUsagePercent.toFixed(1)}%, RAM: ${ramUsagePercent.toFixed(1)}%`,
    //   );
    // } // tat đi để tránh spam log khi đang phát triển, sẽ bật lại khi deploy sản phẩm

    const metric = new this.metricModel({
      path: req.url, // Không còn lỗi unsafe-member-access
      method: req.method, // Không còn lỗi unsafe-member-access
      duration_ms: duration,
      status_code: statusCode,
      is_slow: isSlow,
      cpu_usage_percent: Number(cpuUsagePercent.toFixed(2)),
      ram_usage_percent: Number(ramUsagePercent.toFixed(2)),
      node: process.env.SERVER_NODE || 'Primary Node',
    });

    // Ghi log không đồng bộ để không chặn Request
    metric
      .save()
      .catch((e: unknown) =>
        this.logger.error(
          `Lỗi lưu Performance Metric: ${(e as Error).message}`,
        ),
      );
  }
}
