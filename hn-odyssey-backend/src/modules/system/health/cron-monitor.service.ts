import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import * as os from 'os';

@Injectable()
export class CronMonitorService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // AC12 - US.20: Mỗi Job khi chạy xong sẽ gọi hàm này để báo cáo "tôi còn sống"

  async heartbeat(jobName: string) {
    try {
      await this.redis.set(
        `cron_heartbeat:${jobName}`,
        Date.now().toString(),
        'EX',
        3600, // Key tồn tại trong 1 tiếng
      );
    } catch (error) {
      // Không để lỗi Redis làm sập Cron Job chính
      console.error(`Failed to set heartbeat for ${jobName}`, error);
    }
  }

  //AC12 - US.20: Chạy định kỳ mỗi giờ để kiểm tra "sức khỏe" của các Job ngầm

  @Cron(CronExpression.EVERY_HOUR)
  async checkJobsHealth() {
    const jobs = ['SYNC_STOCK', 'DAILY_REPORT'];

    for (const job of jobs) {
      const lastRun = await this.redis.get(`cron_heartbeat:${job}`);

      if (!lastRun) {
        // Nếu không tìm thấy key (Job đã quá hạn 1 tiếng chưa chạy lại)
        this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
          error_code: 'SCHEDULED_JOB_FAILURE',
          message: `Cảnh báo vận hành: Tác vụ ngầm [${job}] đã không chạy đúng lịch trình trong hơn 1 giờ qua!`,
          severity: 'HIGH',
        });
      }
    }
  }

  // AC3 - US.20: Giám sát RAM / CPU Server Chạy mỗi phút 1 lần

  @Cron(CronExpression.EVERY_MINUTE)
  async monitorSystemResources() {
    try {
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemoryPercent =
        ((totalMemory - freeMemory) / totalMemory) * 100;

      if (usedMemoryPercent > 90) {
        this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
          error_code: 'HIGH_RESOURCE_USAGE',
          message: `Cảnh báo: Máy chủ đang bị quá tải RAM. Mức sử dụng hiện tại: ${usedMemoryPercent.toFixed(2)}%`,
          severity: 'HIGH',
        });
      }

      const loadAvg = os.loadavg()[0];
      const cpuCores = os.cpus().length;
      if (loadAvg > cpuCores) {
        this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
          error_code: 'HIGH_CPU_USAGE',
          message: `Cảnh báo: Máy chủ đang bị quá tải CPU. Load Average: ${loadAvg.toFixed(2)} / ${cpuCores} Cores.`,
          severity: 'HIGH',
        });
      }
    } catch (error) {
      console.error('Lỗi khi monitor tài nguyên:', error);
    }
  }
}
