import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import {
  SystemMetric,
  SystemMetricDocument,
} from './schemas/system-metric.schema';
import {
  IntegrationLog,
  IntegrationLogDocument,
} from './schemas/integration-log.schema';
import {
  DEFAULT_THRESHOLDS,
  SystemThreshold,
  SystemThresholdDocument,
} from './schemas/system-threshold.schema';
import {
  AuditLog,
  AuditLogDocument,
} from '../audit-logs/schemas/audit-log.schema';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  NotificationLog,
  NotificationPriority,
  NotificationType,
} from 'src/modules/notifications/schemas/notification-log.schema';
import { Department } from 'src/common/enums/department.enum';
import { UpdateThresholdsDto } from './dto/update-thresholds.dto';
import {
  getCpuUsagePercent,
  getDiskUsage,
  getRamUsage,
} from './system-usage.util';

export const TIMEFRAME_LAST_HOUR = 'Last Hour (Real-time)';
export const TIMEFRAME_LAST_7_DAYS = 'Last 7 Days';

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Metric chỉ được giữ 7 ngày (TTL trong system-metric.schema) nên uptime tối đa tính được 7 ngày
const UPTIME_WINDOW_DAYS = 7;

// Interface cho Aggregate và Lean Query
interface PerformanceStatResult {
  _id: null;
  avgLatency: number;
  errorCount: number;
  totalCount: number;
}

interface UptimeStatResult {
  _id: null;
  totalCount: number;
  errorCount: number;
}

interface BucketPerfAggResult {
  _id: string;
  avgLatency: number;
  errorCount: number;
  totalCount: number;
}

interface BucketResourceAggResult {
  _id: string;
  avgCpu: number;
  avgRam: number;
}

interface PartnerStatResult {
  _id: string;
  total: number;
  errCount: number;
  avgLatency: number;
  lastCheck: Date;
}

interface PeakCpuResult {
  _id: null;
  peak: number | null;
}

interface SecurityLogAggResult {
  _id: { ip: string; target: string };
  attempts: number;
  lastTime: Date;
}

interface IncidentAggResult {
  _id: { title: string; message: string };
  type: NotificationType;
  priority: NotificationPriority;
  lastTime: Date;
  metadata?: Record<string, unknown>;
}

// Mã lỗi tài nguyên do CronMonitorService phát ra → tên tài nguyên hiển thị
const RESOURCE_ALERT_LABELS: Record<string, string> = {
  HIGH_CPU_USAGE: 'CPU',
  HIGH_RESOURCE_USAGE: 'RAM',
  HIGH_DISK_USAGE: 'Disk',
};

interface PaymentIntegrationLog {
  _id: Types.ObjectId;
  provider: string;
  createdAt: Date;
  request_data?: {
    order_code?: string;
    error_type?: string;
  };
  response_data?: {
    error_message?: string;
    message?: string;
  };
}

export interface SystemStatusWidget {
  status: 'GREEN' | 'YELLOW' | 'RED';
  database: 'UP' | 'DOWN';
  avg_latency: number;
  error_rate: number;
  uptime: string;
}

export interface PerformanceHistoryPoint {
  hour: string;
  avg_latency: number;
  error_rate: number;
}

export interface ThresholdValues {
  cpu: number;
  ram: number;
  disk: number;
}

@Injectable()
export class MonitoringService {
  constructor(
    @InjectModel(SystemMetric.name)
    private readonly metricModel: Model<SystemMetricDocument>,
    @InjectModel(IntegrationLog.name)
    private readonly integrationModel: Model<IntegrationLogDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
    @InjectModel(SystemThreshold.name)
    private readonly thresholdModel: Model<SystemThresholdDocument>,
    @InjectModel(NotificationLog.name)
    private readonly notificationModel: Model<NotificationLog>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // HELPERS

  private getStartDateFromTimeframe(timeframe?: string): Date {
    const now = Date.now();
    if (timeframe === TIMEFRAME_LAST_HOUR)
      return new Date(now - 60 * 60 * 1000);
    if (timeframe === TIMEFRAME_LAST_7_DAYS) return new Date(now - 7 * DAY_MS);
    return new Date(now - DAY_MS); // Mặc định: Last 24 Hours
  }

  // Gom nhóm theo chuỗi ngày-giờ đầy đủ để sort đúng thứ tự thời gian (qua nửa đêm không bị đảo)
  private getBucketConfig(timeframe?: string): {
    format: string;
    toLabel: (key: string) => string;
  } {
    if (timeframe === TIMEFRAME_LAST_HOUR) {
      return { format: '%Y-%m-%d %H:%M', toLabel: (key) => key.slice(11) }; // "14:05"
    }
    if (timeframe === TIMEFRAME_LAST_7_DAYS) {
      return {
        format: '%Y-%m-%d',
        toLabel: (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}`, // "21/10"
      };
    }
    return { format: '%Y-%m-%d %H:00', toLabel: (key) => key.slice(11) }; // "14:00"
  }

  private buildBucketId(format: string) {
    return {
      $dateToString: { format, date: '$createdAt', timezone: VN_TIMEZONE },
    };
  }

  // 00:00 hôm nay theo giờ Việt Nam
  private getStartOfTodayVN(): Date {
    const vnNow = new Date(Date.now() + VN_OFFSET_MS);
    vnNow.setUTCHours(0, 0, 0, 0);
    return new Date(vnNow.getTime() - VN_OFFSET_MS);
  }

  // US2 - Hiệu năng Server
  async getPerformanceStats(timeframe?: string) {
    const fromDate = this.getStartDateFromTimeframe(timeframe);

    const stats = await this.metricModel.aggregate<PerformanceStatResult>([
      { $match: { createdAt: { $gte: fromDate } } },
      {
        $group: {
          _id: null,
          avgLatency: { $avg: '$duration_ms' },
          totalCount: { $sum: 1 },
          errorCount: {
            $sum: { $cond: [{ $gte: ['$status_code', 500] }, 1, 0] },
          },
        },
      },
    ]);

    const result = stats[0] || { avgLatency: 0, errorCount: 0, totalCount: 0 };
    const errorRate =
      result.totalCount > 0 ? (result.errorCount / result.totalCount) * 100 : 0;

    const slowRequestsCount = await this.metricModel.countDocuments({
      is_slow: true,
      createdAt: { $gte: fromDate },
    });

    return {
      avg_latency_ms: Number((result.avgLatency || 0).toFixed(0)),
      error_rate_percent: Number(errorRate.toFixed(2)),
      slow_requests: slowRequestsCount,
    };
  }

  // US5 - Trạng thái API đối tác
  async getThirdPartyStatus(timeframe?: string) {
    const fromDate = this.getStartDateFromTimeframe(timeframe);

    const partnerStats =
      await this.integrationModel.aggregate<PartnerStatResult>([
        {
          $match: {
            createdAt: { $gte: fromDate },
            provider: { $ne: 'UNKNOWN' },
          },
        },
        {
          $group: {
            _id: '$provider',
            total: { $sum: 1 },
            errCount: { $sum: { $cond: [{ $eq: ['$is_error', true] }, 1, 0] } },
            avgLatency: { $avg: '$duration_ms' },
            lastCheck: { $max: '$createdAt' },
          },
        },
        { $sort: { _id: 1 } },
      ]);

    return partnerStats.map((p) => {
      const errRate = p.total > 0 ? (p.errCount / p.total) * 100 : 0;
      let status: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';

      if (errRate > 10) status = 'RED';
      else if (p.avgLatency > 3000) status = 'YELLOW';

      return {
        provider: p._id,
        status,
        error_rate: Number(errRate.toFixed(2)),
        avg_latency: Number((p.avgLatency || 0).toFixed(0)),
        last_check: p.lastCheck,
      };
    });
  }

  // US1 - AC2: Đèn trạng thái tổng quan
  async getSystemStatusWidget(timeframe?: string): Promise<SystemStatusWidget> {
    const fromDate = this.getStartDateFromTimeframe(timeframe);
    const uptimeFrom = new Date(Date.now() - UPTIME_WINDOW_DAYS * DAY_MS);

    const [stats, uptimeStats] = await Promise.all([
      this.metricModel.aggregate<PerformanceStatResult>([
        { $match: { createdAt: { $gte: fromDate } } },
        {
          $group: {
            _id: null,
            avgLatency: { $avg: '$duration_ms' },
            errorCount: {
              $sum: { $cond: [{ $gte: ['$status_code', 500] }, 1, 0] },
            },
            totalCount: { $sum: 1 },
          },
        },
      ]),
      this.metricModel.aggregate<UptimeStatResult>([
        { $match: { createdAt: { $gte: uptimeFrom } } },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            errorCount: {
              $sum: { $cond: [{ $gte: ['$status_code', 500] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const result = stats[0] || { avgLatency: 0, errorCount: 0, totalCount: 0 };
    const errorRate =
      result.totalCount > 0 ? (result.errorCount / result.totalCount) * 100 : 0;

    const uptimeData = uptimeStats[0] || { totalCount: 0, errorCount: 0 };
    const uptime =
      uptimeData.totalCount > 0
        ? (
            ((uptimeData.totalCount - uptimeData.errorCount) /
              uptimeData.totalCount) *
            100
          ).toFixed(2) + '%'
        : '100.00%';

    let dbStatus: 'UP' | 'DOWN' = 'UP';
    try {
      if ((this.metricModel.db.readyState as number) !== 1) dbStatus = 'DOWN';
    } catch {
      dbStatus = 'DOWN';
    }

    let status: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    if (dbStatus === 'DOWN' || errorRate > 10) {
      status = 'RED';
    } else if ((result.avgLatency || 0) > 2000) {
      status = 'YELLOW';
    }

    return {
      status,
      database: dbStatus,
      avg_latency: Number((result.avgLatency || 0).toFixed(0)),
      error_rate: Number(errorRate.toFixed(2)),
      uptime,
    };
  }

  // US1-AC6 & US2-AC6: Lịch sử hiệu năng vẽ biểu đồ
  async getPerformanceHistory(
    timeframe?: string,
  ): Promise<PerformanceHistoryPoint[]> {
    const fromDate = this.getStartDateFromTimeframe(timeframe);
    const { format, toLabel } = this.getBucketConfig(timeframe);

    const history = await this.metricModel.aggregate<BucketPerfAggResult>([
      { $match: { createdAt: { $gte: fromDate } } },
      {
        $group: {
          _id: this.buildBucketId(format),
          avgLatency: { $avg: '$duration_ms' },
          errorCount: {
            $sum: { $cond: [{ $gte: ['$status_code', 500] }, 1, 0] },
          },
          totalCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return history.map((h) => ({
      hour: toLabel(h._id),
      avg_latency: Number((h.avgLatency || 0).toFixed(0)),
      error_rate:
        h.totalCount > 0
          ? Number(((h.errorCount / h.totalCount) * 100).toFixed(2))
          : 0,
    }));
  }

  // US3 - AC6: Lịch sử lỗi giao dịch thanh toán
  async getPaymentErrorLogs(
    page: number = 1,
    limit: number = 20,
    provider?: string,
    timeframe?: string,
  ) {
    const skip = (page - 1) * limit;
    const fromDate = this.getStartDateFromTimeframe(timeframe);

    const baseQuery: FilterQuery<IntegrationLogDocument> = {
      provider: { $in: ['VNPAY', 'MOMO'] },
      is_error: true,
    };
    if (provider) {
      baseQuery.provider = provider.toUpperCase();
    }

    const listQuery: FilterQuery<IntegrationLogDocument> = {
      ...baseQuery,
      createdAt: { $gte: fromDate },
    };
    const todayQuery: FilterQuery<IntegrationLogDocument> = {
      ...baseQuery,
      createdAt: { $gte: this.getStartOfTodayVN() },
    };

    const [items, totalItems, todayCount] = await Promise.all([
      this.integrationModel
        .find(listQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('provider createdAt request_data response_data')
        .lean<PaymentIntegrationLog[]>()
        .exec(),
      this.integrationModel.countDocuments(listQuery).exec(),
      this.integrationModel.countDocuments(todayQuery).exec(),
    ]);

    const formattedItems = items.map((item) => ({
      _id: item._id,
      provider: item.provider,
      date: item.createdAt,
      order_code: item.request_data?.order_code || 'N/A',
      error_type: item.request_data?.error_type || 'UNKNOWN',
      error_message:
        item.response_data?.error_message ||
        item.response_data?.message ||
        'Lỗi không xác định',
    }));

    return {
      items: formattedItems,
      meta: {
        totalItems,
        todayCount,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  // Gauge overview: đo trực tiếp tài nguyên máy chủ tại thời điểm gọi
  async getCurrentResources(timeframe?: string) {
    const fromDate = this.getStartDateFromTimeframe(timeframe);

    const [peakResult] = await this.metricModel.aggregate<PeakCpuResult>([
      { $match: { createdAt: { $gte: fromDate } } },
      { $group: { _id: null, peak: { $max: '$cpu_usage_percent' } } },
    ]);

    const currentCpu = getCpuUsagePercent();
    const peakCpu = Math.min(Math.max(currentCpu, peakResult?.peak ?? 0), 100);

    return {
      cpu: { current: currentCpu, peak: Number(peakCpu.toFixed(1)) },
      ram: getRamUsage(),
      disk: getDiskUsage(),
    };
  }

  // Biểu đồ LineChart CPU/RAM
  async getResourceHistory(timeframe?: string) {
    const fromDate = this.getStartDateFromTimeframe(timeframe);
    const { format, toLabel } = this.getBucketConfig(timeframe);

    const history = await this.metricModel.aggregate<BucketResourceAggResult>([
      { $match: { createdAt: { $gte: fromDate } } },
      {
        $group: {
          _id: this.buildBucketId(format),
          avgCpu: { $avg: '$cpu_usage_percent' },
          avgRam: { $avg: '$ram_usage_percent' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return history.map((h) => ({
      time: toLabel(h._id),
      cpu: Number(Math.min(h.avgCpu || 0, 100).toFixed(1)),
      ram: Number(Math.min(h.avgRam || 0, 100).toFixed(1)),
    }));
  }

  // US4 - Log bảo mật đã gom nhóm số lần vi phạm
  async getAggregatedSecurityLogs(timeframe?: string) {
    const fromDate = this.getStartDateFromTimeframe(timeframe);

    const logs = await this.auditLogModel.aggregate<SecurityLogAggResult>([
      { $match: { createdAt: { $gte: fromDate }, is_success: false } },
      {
        $group: {
          _id: { ip: '$ip', target: '$actor_email' },
          attempts: { $sum: 1 },
          lastTime: { $max: '$createdAt' },
        },
      },
      { $sort: { lastTime: -1 } },
      { $limit: 10 },
    ]);

    return logs.map((log) => ({
      id: `${log._id.ip}-${log._id.target}`,
      time: log.lastTime,
      ip: log._id.ip || 'unknown',
      target: log._id.target || 'N/A',
      attempts: log.attempts,
      status: log.attempts >= 5 ? 'IP Blocked' : 'Warning',
    }));
  }

  // Sự cố thật: lấy từ thông báo SYSTEM/SECURITY mà hệ thống đã phát ra
  async getRecentIncidents(timeframe?: string) {
    const fromDate = this.getStartDateFromTimeframe(timeframe);

    // 1 sự cố được gửi cho nhiều người nhận -> gom theo title + message để không bị lặp
    const rows = await this.notificationModel.aggregate<IncidentAggResult>([
      {
        $match: {
          type: { $in: [NotificationType.SYSTEM, NotificationType.SECURITY] },
          createdAt: { $gte: fromDate },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { title: '$title', message: '$message' },
          type: { $first: '$type' },
          priority: { $first: '$priority' },
          lastTime: { $first: '$createdAt' },
          metadata: { $first: '$metadata' },
        },
      },
      { $sort: { lastTime: -1 } },
      { $limit: 20 },
    ]);

    const isSevere = (p: NotificationPriority) =>
      p === NotificationPriority.CRITICAL || p === NotificationPriority.HIGH;

    return {
      active_count: rows.filter((r) => isSevere(r.priority)).length,
      items: rows.slice(0, 10).map((r, index) => ({
        id: `${new Date(r.lastTime).getTime()}-${index}`,
        time: r.lastTime,
        severity:
          r.priority === NotificationPriority.CRITICAL ? 'Critical' : 'Warning',
        component: r.type === NotificationType.SYSTEM ? 'System' : 'Security',
        message: this.toEnglishIncidentMessage(
          r.type,
          r._id.message,
          r.metadata,
        ),
      })),
    };
  }

  // Dựng câu tiếng Anh cho Recent Incident Log từ error_code + số liệu trong câu gốc.
  // Áp dụng được cho cả thông báo cũ lẫn mới, không sửa dữ liệu trong DB.
  private toEnglishIncidentMessage(
    type: NotificationType,
    message: string,
    metadata?: Record<string, unknown>,
  ): string {
    const code =
      typeof metadata?.error_code === 'string' ? metadata.error_code : '';
    const ip = typeof metadata?.ip === 'string' ? metadata.ip : '';

    // 1. Cảnh báo tài nguyên: "... ở mức 86.7%, vượt ngưỡng 85%."
    const resource = RESOURCE_ALERT_LABELS[code];
    if (resource) {
      const percents = message.match(/\d+(?:\.\d+)?%/g) ?? [];
      if (percents.length >= 2) {
        return `${resource} usage is at ${percents[0]}, exceeding the ${percents[1]} threshold.`;
      }
      if (percents.length === 1) {
        return `${resource} usage is at ${percents[0]}, above the alert threshold.`;
      }
      return `${resource} usage exceeded the configured alert threshold.`;
    }

    // 2. Lỗi đối tác: 3RD_PARTY_FAIL_<PROVIDER>
    if (code.startsWith('3RD_PARTY_FAIL_')) {
      const provider = code.replace('3RD_PARTY_FAIL_', '');
      const httpStatus = message.match(/HTTP (\d{3})/)?.[1];
      const latency = message.match(/(\d+)ms/)?.[1];
      return `Third-party service ${provider} is not responding properly${
        httpStatus ? ` (HTTP ${httpStatus})` : ''
      }${latency ? `, response time ${latency}ms` : ''}.`;
    }

    // 3. Tác vụ ngầm không chạy đúng lịch: "Tác vụ ngầm [JOB_NAME] ..."
    if (code === 'SCHEDULED_JOB_FAILURE') {
      const job = message.match(/\[([^\]]+)\]/)?.[1];
      return `Background job ${job ?? '(unknown)'} has not run on schedule for over 1 hour.`;
    }

    // 4. Cảnh báo bảo mật
    if (type === NotificationType.SECURITY) {
      const account = message.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
      const from = ip ? ` from IP ${ip}` : '';
      if (/brute-?force/i.test(message)) {
        return `Brute-force attack detected${
          account ? ` on account ${account}` : ''
        }${from}. The account has been temporarily locked.`;
      }
      return `Security alert: suspicious activity detected${from}.`;
    }

    // 5. Lỗi hệ thống khác có mã lỗi
    if (code) return `System error reported (${code}).`;

    return message;
  }

  // NGƯỠNG CẢNH BÁO
  async getThresholds(): Promise<ThresholdValues> {
    const doc = await this.thresholdModel
      .findOne({ key: 'default' })
      .lean<ThresholdValues>()
      .exec();

    return {
      cpu: doc?.cpu ?? DEFAULT_THRESHOLDS.cpu,
      ram: doc?.ram ?? DEFAULT_THRESHOLDS.ram,
      disk: doc?.disk ?? DEFAULT_THRESHOLDS.disk,
    };
  }

  async updateThresholds(
    dto: UpdateThresholdsDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ): Promise<ThresholdValues> {
    const before = await this.getThresholds();
    const after: ThresholdValues = {
      cpu: dto.cpu,
      ram: dto.ram,
      disk: dto.disk,
    };

    await this.thresholdModel
      .findOneAndUpdate(
        { key: 'default' },
        {
          $set: {
            ...after,
            updated_by: Types.ObjectId.isValid(actorId)
              ? new Types.ObjectId(actorId)
              : null,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    await this.auditLogsService.log({
      action: 'UPDATE_SYSTEM_THRESHOLDS',
      collection_name: 'system_thresholds',
      actor_id: actorId,
      target_id: null,
      department: Department.MANAGEMENT,
      detail: { before, after },
      ip,
      user_agent: userAgent,
    });

    return after;
  }
}
