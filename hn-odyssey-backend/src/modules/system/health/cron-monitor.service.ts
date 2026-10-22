import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { MonitoringService } from '../monitoring/monitoring.service';
import {
  getCpuUsagePercent,
  getDiskUsage,
  getRamUsage,
} from '../monitoring/system-usage.util';

// Chỉ thêm tên job vào đây khi job đó đã gọi heartbeat() sau mỗi lần chạy,
// nếu không cron sẽ báo "job không chạy" giả mỗi giờ.
const MONITORED_JOBS: string[] = [];

// Mỗi loại tài nguyên chỉ cảnh báo tối đa 1 lần / 15 phút
const ALERT_THROTTLE_SECONDS = 15 * 60;

@Injectable()
export class CronMonitorService {
  private readonly logger = new Logger(CronMonitorService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly monitoringService: MonitoringService,
  ) {}

  // AC12 - US.20: Mỗi Job chạy xong gọi hàm này để báo "tôi còn sống"
  async heartbeat(jobName: string) {
    try {
      await this.redis.set(
        `cron_heartbeat:${jobName}`,
        Date.now().toString(),
        'EX',
        3600,
      );
    } catch (error) {
      this.logger.error(`Không thể ghi heartbeat cho ${jobName}`, error);
    }
  }

  // AC12 - US.20: Mỗi giờ kiểm tra các Job ngầm còn chạy đúng lịch không
  @Cron(CronExpression.EVERY_HOUR)
  async checkJobsHealth() {
    for (const job of MONITORED_JOBS) {
      const lastRun = await this.redis.get(`cron_heartbeat:${job}`);
      if (!lastRun) {
        this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
          error_code: 'SCHEDULED_JOB_FAILURE',
          message: `Cảnh báo vận hành: Tác vụ ngầm [${job}] đã không chạy đúng lịch trình trong hơn 1 giờ qua!`,
          severity: 'HIGH',
        });
      }
    }
  }

  // AC3 - US.20: Mỗi phút so sánh CPU/RAM/Disk với ngưỡng Admin đã cấu hình
  @Cron(CronExpression.EVERY_MINUTE)
  async monitorSystemResources() {
    try {
      const thresholds = await this.monitoringService.getThresholds();

      const checks = [
        {
          key: 'CPU',
          code: 'HIGH_CPU_USAGE',
          value: getCpuUsagePercent(),
          limit: thresholds.cpu,
        },
        {
          key: 'RAM',
          code: 'HIGH_RESOURCE_USAGE',
          value: getRamUsage().percent,
          limit: thresholds.ram,
        },
        {
          key: 'DISK',
          code: 'HIGH_DISK_USAGE',
          value: getDiskUsage().percent,
          limit: thresholds.disk,
        },
      ];

      for (const check of checks) {
        if (check.value <= check.limit) continue;

        // SET NX: chỉ lần vượt ngưỡng đầu tiên trong 15 phút mới được gửi cảnh báo
        const isFirstAlert = await this.redis.set(
          `throttle:resource_alert:${check.key}`,
          '1',
          'EX',
          ALERT_THROTTLE_SECONDS,
          'NX',
        );
        if (!isFirstAlert) continue;

        this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
          error_code: check.code,
          message: `Cảnh báo: ${check.key} của máy chủ đang ở mức ${check.value}%, vượt ngưỡng ${check.limit}%.`,
          severity: 'HIGH',
        });
      }
    } catch (error) {
      this.logger.error(
        'Lỗi khi giám sát tài nguyên',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
