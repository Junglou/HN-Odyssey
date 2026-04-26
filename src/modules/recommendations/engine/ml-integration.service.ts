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

  constructor(private readonly configService: ConfigService) {
    this.mlApiUrl =
      this.configService.get<string>('ML_ENGINE_URL') ||
      'http://localhost:8000';
  }

  // AC1 & AC8: Gọi API suy luận nhanh (<200ms)
  async getAiRecommendations(userId: string): Promise<string[]> {
    try {
      const response = await axios.get<MLRecommendResponse>(
        `${this.mlApiUrl}/recommend/${userId}`,
        {
          timeout: 200,
        },
      );
      return response.data.recommended_product_ids || [];
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Lỗi gọi ML Engine: ${msg}. Fallback về MongoDB Aggregation.`,
      );
      return [];
    }
  }

  // AC8: Huấn luyện định kỳ mỗi đêm
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { timeZone: 'Asia/Ho_Chi_Minh' })
  async triggerNightlyModelRetrain(): Promise<void> {
    this.logger.log('Bắt đầu trigger Re-train ML Model...');
    try {
      await axios.post(`${this.mlApiUrl}/train`, {}, { timeout: 300000 }); // Timeout 5 phút
      this.logger.log('Lệnh Re-train ML Model đã hoàn tất.');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Lỗi khi Re-train: ${msg}`);
    }
  }
}
