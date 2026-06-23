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
  AuditLog,
  AuditLogDocument,
} from '../audit-logs/schemas/audit-log.schema';
import * as fs from 'fs';

// Định nghĩa các interface cho Aggregate và Lean Query
interface PerformanceStatResult {
  _id: null;
  avgLatency: number;
  errorCount: number;
  totalCount: number;
}

interface PerformanceHistoryAggResult {
  _id: number;
  avgLatency: number;
  errorCount: number;
  totalCount: number;
}

interface PartnerStatResult {
  _id: string;
  total: number;
  errCount: number;
  avgLatency: number;
}

interface ResourceHistoryAggResult {
  _id: number;
  avgCpu: number;
  avgRam: number;
}

// Bổ sung interface cho widget uptime
interface UptimeStatResult {
  _id: null;
  totalCount: number;
  errorCount: number;
}

// Bổ sung interface cho log bảo mật
interface SecurityLogAggResult {
  _id: { ip: string; target: string };
  attempts: number;
  lastTime: Date;
}

export interface SystemStatusWidget {
  status: 'GREEN' | 'YELLOW' | 'RED';
  database: 'UP' | 'DOWN';
  avg_latency: number;
  error_rate: number;
  uptime: string; // Thêm thuộc tính uptime vào interface
}

export interface PerformanceHistoryPoint {
  hour: string;
  avg_latency: number;
  error_rate: number;
}

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

@Injectable()
export class MonitoringService {
  constructor(
    @InjectModel(SystemMetric.name)
    private readonly metricModel: Model<SystemMetricDocument>,
    @InjectModel(IntegrationLog.name)
    private readonly integrationModel: Model<IntegrationLogDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  // Hàm tính toán khung thời gian
  private getStartDateFromTimeframe(timeframe?: string): Date {
    const now = Date.now();
    if (timeframe === 'Last Hour (Real-time)') {
      return new Date(now - 60 * 60 * 1000);
    } else if (timeframe === 'Last 7 Days') {
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    }
    // Mặc định là Last 24 Hours
    return new Date(now - 24 * 60 * 60 * 1000);
  }

  // Hàm tạo query filter MongoDB cho Node
  private buildNodeFilter(node?: string) {
    if (!node || node === 'All Nodes') return {};
    return { node };
  }

  async getPerformanceStats(timeframe?: string, node?: string) {
    const fromDate = this.getStartDateFromTimeframe(timeframe);
    const nodeFilter = this.buildNodeFilter(node);

    const stats = await this.metricModel.aggregate<PerformanceStatResult>([
      { $match: { createdAt: { $gte: fromDate }, ...nodeFilter } },
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
      ...nodeFilter,
    });

    return {
      avg_latency_ms: Number(result.avgLatency.toFixed(0)),
      error_rate_percent: Number(errorRate.toFixed(2)),
      slow_requests: slowRequestsCount,
    };
  }

  async getThirdPartyStatus(timeframe?: string) {
    const fromDate = this.getStartDateFromTimeframe(timeframe);

    const partnerStats =
      await this.integrationModel.aggregate<PartnerStatResult>([
        { $match: { createdAt: { $gte: fromDate } } },
        {
          $group: {
            _id: '$provider',
            total: { $sum: 1 },
            errCount: { $sum: { $cond: [{ $eq: ['$is_error', true] }, 1, 0] } },
            avgLatency: { $avg: '$duration_ms' },
          },
        },
      ]);

    return partnerStats.map((p) => {
      const errRate = p.total > 0 ? (p.errCount / p.total) * 100 : 0;
      let status: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';

      if (errRate > 10) status = 'RED';
      else if (p.avgLatency > 3000) status = 'YELLOW';

      return {
        provider: p._id,
        status: status,
        error_rate: Number(errRate.toFixed(2)),
        avg_latency: Number(p.avgLatency.toFixed(0)),
      };
    });
  }

  // Khử lỗi unsafe bằng cách thêm generic type cho hàm aggregate
  async getSystemStatusWidget(
    timeframe?: string,
    node?: string,
  ): Promise<SystemStatusWidget> {
    const fromDate = this.getStartDateFromTimeframe(timeframe);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const nodeFilter = this.buildNodeFilter(node);

    const [stats, uptimeStats] = await Promise.all([
      this.metricModel.aggregate<PerformanceStatResult>([
        { $match: { createdAt: { $gte: fromDate }, ...nodeFilter } },
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
        { $match: { createdAt: { $gte: thirtyDaysAgo }, ...nodeFilter } },
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
    } else if (result.avgLatency > 2000) {
      status = 'YELLOW';
    }

    return {
      status,
      database: dbStatus,
      avg_latency: Number(result.avgLatency.toFixed(0)),
      error_rate: Number(errorRate.toFixed(2)),
      uptime: uptime,
    };
  }

  async getPerformanceHistory24h(
    timeframe?: string,
    node?: string,
  ): Promise<PerformanceHistoryPoint[]> {
    const fromDate = this.getStartDateFromTimeframe(timeframe);
    const nodeFilter = this.buildNodeFilter(node);

    // Dynamic grouping: Group theo Phút nếu là Real-time, Group theo Giờ nếu là 24h hoặc 7 days
    const isRealTime = timeframe === 'Last Hour (Real-time)';
    const groupId = isRealTime
      ? { $minute: { date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' } }
      : { $hour: { date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' } };

    const history =
      await this.metricModel.aggregate<PerformanceHistoryAggResult>([
        { $match: { createdAt: { $gte: fromDate }, ...nodeFilter } },
        {
          $group: {
            _id: groupId,
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
      hour: isRealTime ? `Min ${h._id}` : `${h._id}:00`,
      avg_latency: Number((h.avgLatency || 0).toFixed(0)),
      error_rate:
        h.totalCount > 0
          ? Number(((h.errorCount / h.totalCount) * 100).toFixed(2))
          : 0,
    }));
  }

  async getPaymentErrorLogs(
    page: number = 1,
    limit: number = 20,
    provider?: string,
    timeframe?: string,
  ) {
    const skip = (page - 1) * limit;
    const fromDate = this.getStartDateFromTimeframe(timeframe);

    const query: FilterQuery<IntegrationLogDocument> = {
      provider: { $in: ['VNPAY', 'MOMO'] },
      is_error: true,
      createdAt: { $gte: fromDate },
    };

    if (provider) {
      query.provider = provider.toUpperCase();
    }

    const [items, totalItems] = await Promise.all([
      this.integrationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('provider createdAt request_data response_data')
        .lean<PaymentIntegrationLog[]>()
        .exec(),
      this.integrationModel.countDocuments(query).exec(),
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
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async getCurrentResources(node?: string) {
    const nodeFilter = this.buildNodeFilter(node);
    const latestMetric = await this.metricModel
      .findOne(nodeFilter)
      .sort({ createdAt: -1 })
      .lean();

    let diskPercent = 0;
    let diskText = 'N/A';
    try {
      const stat = fs.statfsSync(process.cwd());
      const totalBytes = stat.blocks * stat.bsize;
      const freeBytes = stat.bfree * stat.bsize;
      const usedBytes = totalBytes - freeBytes;

      diskPercent = (usedBytes / totalBytes) * 100;
      diskText = `${(usedBytes / 1024 ** 3).toFixed(1)}GB / ${(totalBytes / 1024 ** 3).toFixed(1)}GB`;
    } catch {
      diskPercent = 0;
      diskText = 'Không thể đọc ổ đĩa';
    }

    return {
      cpu: {
        current: latestMetric?.cpu_usage_percent || 0,
        peak: Math.max((latestMetric?.cpu_usage_percent || 0) + 15, 100),
      },
      ram: {
        percent: latestMetric?.ram_usage_percent || 0,
        text: 'Dữ liệu thực tế',
      },
      disk: {
        percent: Number(diskPercent.toFixed(1)),
        text: diskText,
      },
    };
  }

  async getResourceHistory24h(timeframe?: string, node?: string) {
    const fromDate = this.getStartDateFromTimeframe(timeframe);
    const nodeFilter = this.buildNodeFilter(node);

    const isRealTime = timeframe === 'Last Hour (Real-time)';
    const groupId = isRealTime
      ? { $minute: { date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' } }
      : { $hour: { date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' } };

    const history = await this.metricModel.aggregate<ResourceHistoryAggResult>([
      { $match: { createdAt: { $gte: fromDate }, ...nodeFilter } },
      {
        $group: {
          _id: groupId,
          avgCpu: { $avg: '$cpu_usage_percent' },
          avgRam: { $avg: '$ram_usage_percent' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return history.map((h) => ({
      time: isRealTime ? `${h._id}m` : `${h._id}h`,
      cpu: Number((h.avgCpu || 0).toFixed(1)),
      ram: Number((h.avgRam || 0).toFixed(1)),
    }));
  }

  // Khử lỗi unsafe bằng cách sử dụng generic SecurityLogAggResult
  async getAggregatedSecurityLogs(timeframe?: string) {
    const fromDate = this.getStartDateFromTimeframe(timeframe);

    const logs = await this.auditLogModel.aggregate<SecurityLogAggResult>([
      {
        $match: {
          createdAt: { $gte: fromDate },
          is_success: false,
        },
      },
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
}
