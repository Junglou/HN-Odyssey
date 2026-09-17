import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface MLRecommendResponse {
  user_id: string;
  recommended_product_ids: string[];
}

@Injectable()
export class MlIntegrationService {
  private readonly logger = new Logger(MlIntegrationService.name);
  private readonly mlApiUrl: string;

  // FIX 1: Thêm biến tĩnh (static) để dùng chung bộ nhớ cho tất cả 7 instances
  private static isCronRunning = false;

  constructor(private readonly configService: ConfigService) {
    this.mlApiUrl =
      this.configService.get<string>('ML_ENGINE_URL') ||
      'http://127.0.0.1:8000';
  }

  // AC1 & AC8: Gọi API suy luận nhanh (<200ms)
  async getAiRecommendations(userId: string): Promise<string[]> {
    try {
      const response = await axios.get<MLRecommendResponse>(
        `${this.mlApiUrl}/recommend/${userId}`,
        {
          timeout: 3000,
        },
      );
      return response.data.recommended_product_ids || [];
    } catch (error: unknown) {
      let msg = 'Lỗi không xác định';
      if (error instanceof Error) {
        msg = error.message;
      } else {
        msg = String(error);
      }
      this.logger.warn(
        `Lỗi gọi ML Engine: ${msg}. Fallback về MongoDB Aggregation.`,
      );
      return [];
    }
  }

  // FIX 2: Bọc khóa tĩnh vào CronJob và trả về đúng 2h sáng
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { timeZone: 'Asia/Ho_Chi_Minh' })
  async triggerNightlyModelRetrain(): Promise<void> {
    // Nếu đã có 1 instance chạy rồi thì 6 instance đằng sau lập tức bị chặn
    if (MlIntegrationService.isCronRunning) return;

    // Đóng khóa
    MlIntegrationService.isCronRunning = true;

    this.logger.log('Bắt đầu trigger Re-train ML Model...');
    try {
      await axios.post(`${this.mlApiUrl}/train`, {}, { timeout: 300000 }); // Timeout 5 phút
      this.logger.log('Lệnh Re-train ML Model đã gửi thành công.');
    } catch (error: unknown) {
      let msg = 'Lỗi không xác định';

      if (error instanceof Error) {
        msg = error.message;

        // Xử lý Axios Error bằng TypeScript thuần (Record & in operator)
        if ('isAxiosError' in error && 'response' in error) {
          const axiosErr = error as Record<string, unknown>;
          const response = axiosErr.response as
            | Record<string, unknown>
            | undefined;

          if (response && response.data !== undefined) {
            msg = JSON.stringify(response.data);
          }
        }
      } else {
        msg = String(error);
      }

      this.logger.error(`Lỗi khi Re-train: ${msg}`);
    } finally {
      // Giữ khóa trong 60 giây để chắc chắn cùng một thời điểm không có sự cố lặp lại
      setTimeout(() => {
        MlIntegrationService.isCronRunning = false;
      }, 60000);
    }
  }
}
