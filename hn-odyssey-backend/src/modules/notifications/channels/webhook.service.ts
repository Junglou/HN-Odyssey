import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  constructor(private readonly configService: ConfigService) {}

  async sendToSlackOrTeams(message: string, severity: string) {
    const webhookUrl = this.configService.get<string>('SLACK_WEBHOOK_URL');
    if (!webhookUrl) return;

    try {
      await axios.post(webhookUrl, {
        text: `[${severity}] H&N Odyssey Alert: ${message}`,
      });
    } catch (error: unknown) {
      this.logger.error(
        'Failed to send webhook notification',
        (error as Error).message,
      );
    }
  }
}
