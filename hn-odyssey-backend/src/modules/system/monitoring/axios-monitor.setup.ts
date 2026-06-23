import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import axios from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IntegrationLog,
  IntegrationLogDocument,
} from '../../system/monitoring/schemas/integration-log.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';

// 1. Khai báo Interface độc lập, không phụ thuộc vào version của Axios để tránh lỗi Generic
interface ITrackerConfig {
  url?: string;
  data?: unknown;
  metadata?: { startTime: number };
}

// 2. Duck-typing cho Axios Error thay vì import AxiosError từ thư viện
interface ISafeAxiosError extends Error {
  isAxiosError: boolean;
  config?: ITrackerConfig;
  response?: {
    status?: number;
    data?: unknown;
  };
}

@Injectable()
export class AxiosMonitorSetup implements OnModuleInit {
  private readonly logger = new Logger('AxiosMonitor');

  constructor(
    @InjectModel(IntegrationLog.name)
    private logModel: Model<IntegrationLogDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    // Để TypeScript tự suy luận (infer) kiểu của config dựa vào đúng version Axios bạn đang dùng
    axios.interceptors.request.use((config) => {
      // Ép kiểu qua unknown rồi mới sang Interface tự chế để ESLint không báo lỗi Unsafe
      const tracker = config as unknown as ITrackerConfig;
      tracker.metadata = { startTime: Date.now() };
      return config;
    });

    axios.interceptors.response.use(
      (response) => {
        const tracker = response.config as unknown as ITrackerConfig;
        const status = response.status;
        const data = response.data;

        this.saveLog(tracker, status, data, false);
        return response;
      },
      (err: unknown) => {
        let tracker: ITrackerConfig | undefined = undefined;
        let status = 500;
        let data: unknown = { message: 'Unknown error' };
        let rejectError: Error;

        // Tự kiểm tra đối tượng an toàn thay vì gọi axios.isAxiosError(err) để né lỗi Type
        const isAxiosErr =
          typeof err === 'object' && err !== null && 'isAxiosError' in err;

        if (isAxiosErr) {
          const safeErr = err as ISafeAxiosError;
          tracker = safeErr.config;
          status = safeErr.response?.status ?? 500;
          data = safeErr.response?.data ?? { message: safeErr.message };
          rejectError = safeErr;
        } else {
          rejectError = err instanceof Error ? err : new Error(String(err));
        }

        if (tracker) {
          this.saveLog(tracker, status, data, true);
        }

        return Promise.reject(rejectError);
      },
    );
    this.logger.log(
      'Global Axios Interceptor attached for 3rd Party Monitoring.',
    );
  }

  private saveLog(
    config: ITrackerConfig,
    status: number,
    responseData: unknown,
    isError: boolean,
  ) {
    if (!config || !config.metadata) return;

    const duration = Date.now() - config.metadata.startTime;
    const url = config.url || '';

    let provider = 'UNKNOWN';
    if (url.includes('ghn.vn')) provider = 'GHN';
    else if (url.includes('ghtklab')) provider = 'GHTK';
    else if (url.includes('momo.vn')) provider = 'MOMO';
    else if (url.includes('vnpay.vn')) provider = 'VNPAY';
    else if (url.includes('127.0.0.1') || url.includes('localhost'))
      provider = 'ML_ENGINE';

    let requestData: Record<string, unknown> = {};
    if (typeof config.data === 'string') {
      try {
        const parsed = JSON.parse(config.data || '{}') as unknown;
        requestData = parsed as Record<string, unknown>;
      } catch {
        requestData = { raw_data: config.data } as Record<string, unknown>;
      }
    } else if (config.data && typeof config.data === 'object') {
      requestData = config.data as Record<string, unknown>;
    }

    if (isError && status >= 500) {
      this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
        severity: 'HIGH',
        error_code: `3RD_PARTY_FAIL_${provider}`,
        message: `Mất kết nối hoặc đối tác ${provider} đang bị lỗi (HTTP ${status}). Độ trễ: ${duration}ms. URL: ${url}`,
      });
      this.logger.warn(
        `[API ĐỐI TÁC LỖI] ${provider} phản hồi ${status} sau ${duration}ms`,
      );
    }

    // Lưu ngầm
    this.logModel
      .create({
        provider,
        url,
        duration_ms: duration,
        status_code: status,
        is_error: isError,
        request_data: requestData,
        response_data: responseData as Record<string, unknown>,
      })
      .catch((err: unknown) => {
        this.logger.error(
          'Không thể lưu log tích hợp',
          err instanceof Error ? err.message : String(err),
        );
      });
  }
}
