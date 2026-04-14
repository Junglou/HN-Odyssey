import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IntegrationLog,
  IntegrationLogDocument,
} from '../../system/monitoring/schemas/integration-log.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: { startTime: number };
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
    // 1. Chặn chiều gửi đi (Bắt đầu đếm giờ)
    axios.interceptors.request.use((config: CustomAxiosRequestConfig) => {
      config.metadata = { startTime: Date.now() };
      return config;
    });

    // 2. Chặn chiều nhận về (Success)
    axios.interceptors.response.use(
      (response: AxiosResponse) => {
        this.saveLog(
          response.config as CustomAxiosRequestConfig,
          response.status,
          response.data,
          false,
        );
        return response;
      },
      (error: unknown) => {
        // 3. Chặn chiều nhận về (Fail)
        let config: CustomAxiosRequestConfig | undefined = undefined;
        let status = 500;
        let data: unknown = { message: 'Unknown error' };
        let rejectError: Error;

        // Dùng Type Guard để TypeScript hiểu đây là AxiosError, không còn lỗi Unsafe
        if (axios.isAxiosError(error)) {
          config = error.config as CustomAxiosRequestConfig | undefined;
          status = error.response?.status ?? 500;
          data = error.response?.data ?? { message: error.message };
          rejectError = error; // AxiosError kế thừa từ Error
        } else {
          // Fix lỗi prefer-promise-reject-errors
          rejectError =
            error instanceof Error ? error : new Error(String(error));
        }

        if (config) {
          this.saveLog(config, status, data, true);
        }

        return Promise.reject(rejectError);
      },
    );
    this.logger.log(
      'Global Axios Interceptor attached for 3rd Party Monitoring.',
    );
  }

  private saveLog(
    config: CustomAxiosRequestConfig,
    status: number,
    responseData: unknown,
    isError: boolean,
  ) {
    if (!config || !config.metadata) return;

    const duration = Date.now() - config.metadata.startTime;
    const url = config.url || '';

    // AC1: Phân loại provider dựa trên URL
    let provider = 'UNKNOWN';
    if (url.includes('ghn.vn')) provider = 'GHN';
    else if (url.includes('ghtklab')) provider = 'GHTK';
    else if (url.includes('momo.vn')) provider = 'MOMO';
    else if (url.includes('vnpay.vn')) provider = 'VNPAY';

    // Parse Object an toàn (Fix lỗi Unsafe assignment của JSON.parse)
    let requestData: Record<string, unknown> = {};
    if (typeof config.data === 'string') {
      try {
        requestData = JSON.parse(config.data || '{}') as Record<
          string,
          unknown
        >;
      } catch {
        requestData = { raw_data: config.data } as Record<string, unknown>;
      }
    } else if (config.data && typeof config.data === 'object') {
      requestData = config.data as Record<string, unknown>;
    }

    // [BỔ SUNG 4]: CHỦ ĐỘNG CẢNH BÁO LỖI ĐỐI TÁC (US5)
    // Nếu API đối tác trả về lỗi 5xx hoặc Timeout, gửi cảnh báo ngay
    if (isError && status >= 500) {
      this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
        severity: 'HIGH', // Lỗi đối tác để mức HIGH, không phải CRITICAL để tránh spam sms
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
      .catch(() => {});
  }
}
