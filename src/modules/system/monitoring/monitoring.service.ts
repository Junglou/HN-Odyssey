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

// CÁC INTERFACE DÀNH CHO AGGREGATE VÀ LEAN QUERY
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
  _id: string; // Provider name
  total: number;
  errCount: number;
  avgLatency: number;
}

export interface SystemStatusWidget {
  status: 'GREEN' | 'YELLOW' | 'RED';
  database: 'UP' | 'DOWN';
  avg_latency: number;
  error_rate: number;
}

export interface PerformanceHistoryPoint {
  hour: string;
  avg_latency: number;
  error_rate: number;
}

// Định nghĩa Interface chuẩn xác cho dữ liệu trả về từ bảng IntegrationLog
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
  ) {}

  // Xử lý logic cho US2 - Hiệu năng Server
  async getPerformanceStats() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const stats = await this.metricModel.aggregate<PerformanceStatResult>([
      { $match: { createdAt: { $gte: oneHourAgo } } },
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
      createdAt: { $gte: oneHourAgo },
    });

    return {
      avg_latency_ms: Number(result.avgLatency.toFixed(0)),
      error_rate_percent: Number(errorRate.toFixed(2)),
      slow_requests: slowRequestsCount,
    };
  }

  // Xử lý logic cho US5 - Giám sát đối tác thứ 3
  async getThirdPartyStatus() {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

    const partnerStats =
      await this.integrationModel.aggregate<PartnerStatResult>([
        { $match: { createdAt: { $gte: fifteenMinsAgo } } },
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

      if (errRate > 10)
        status = 'RED'; // AC2: Tỷ lệ lỗi > 10%
      else if (p.avgLatency > 3000) status = 'YELLOW'; // AC3: Trễ > 3s

      return {
        provider: p._id,
        status: status,
        error_rate: Number(errRate.toFixed(2)),
        avg_latency: Number(p.avgLatency.toFixed(0)),
      };
    });
  }

  // FIX: US1-AC2 - HÀM CẤP DỮ LIỆU CHO WIDGET ĐÈN TRẠNG THÁI

  async getSystemStatusWidget(): Promise<SystemStatusWidget> {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

    // FIX ESLINT: Tiêm Type PerformanceStatResult vào hàm aggregate
    const stats = await this.metricModel.aggregate<PerformanceStatResult>([
      { $match: { createdAt: { $gte: fifteenMinsAgo } } },
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
    ]);

    const result = stats[0] || { avgLatency: 0, errorCount: 0, totalCount: 0 };
    const errorRate =
      result.totalCount > 0 ? (result.errorCount / result.totalCount) * 100 : 0;

    let dbStatus: 'UP' | 'DOWN' = 'UP';
    try {
      // Check DB connection state (1 = connected)
      // FIX ESLINT: Ép kiểu readyState về number để so sánh an toàn với số 1
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
    };
  }

  // FIX: US1-AC6 & US2-AC6 - API VẼ BIỂU ĐỒ UPTIME / LATENCY 24H

  async getPerformanceHistory24h(): Promise<PerformanceHistoryPoint[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // FIX ESLINT: Tiêm Type PerformanceHistoryAggResult vào aggregate
    const history =
      await this.metricModel.aggregate<PerformanceHistoryAggResult>([
        { $match: { createdAt: { $gte: twentyFourHoursAgo } } },
        {
          $group: {
            _id: {
              $hour: { date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' },
            },
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
      hour: `${h._id}:00`,
      avg_latency: Number(h.avgLatency.toFixed(0)),
      error_rate:
        h.totalCount > 0
          ? Number(((h.errorCount / h.totalCount) * 100).toFixed(2))
          : 0,
    }));
  }

  // FIX: US3-AC6 - API LỊCH SỬ LỖI THANH TOÁN (ERROR LOG HISTORY)

  async getPaymentErrorLogs(
    page: number = 1,
    limit: number = 20,
    provider?: string,
  ) {
    const skip = (page - 1) * limit;

    // FIX ESLINT: Thay 'any' bằng FilterQuery<IntegrationLogDocument>
    const query: FilterQuery<IntegrationLogDocument> = {
      provider: { $in: ['VNPAY', 'MOMO'] },
      is_error: true,
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
        // FIX ESLINT: Bọc lean<T>() để ép kiểu cứng cho các field dynamic Object
        .lean<PaymentIntegrationLog[]>()
        .exec(),
      this.integrationModel.countDocuments(query).exec(),
    ]);

    // Giờ đây TypeScript đã biết rõ kiểu của request_data và response_data
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
}
