import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { Public } from 'src/common/decorators/public.decorator';
import { ApiOperation } from '@nestjs/swagger';

@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  // INTERNAL API CHO AI AGENT (n8n) SỬ DỤNG

  @Get('internal/chatbot/lookup')
  @Public()
  @ApiOperation({ summary: 'API nội bộ cho Chatbot tra cứu chính sách' })
  async chatbotLookupPolicy(@Query('topic') topic: string) {
    const cleanTopic = topic ? topic.replace(/['"]/g, '').trim() : undefined;

    if (!cleanTopic) {
      throw new BadRequestException('Vui lòng cung cấp topic cần tra cứu');
    }

    return this.policiesService.findPolicyForChatbot(cleanTopic);
  }
}
