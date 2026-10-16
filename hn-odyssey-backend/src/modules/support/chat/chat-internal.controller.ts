import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { InternalApiKeyGuard } from 'src/common/guards/internal-api-key.guard';
import { ChatPersonalizationService } from './chat-personalization.service';

// API nội bộ cho n8n gọi về.
// @Public(): bỏ qua JWT (khách vãng lai không có token), nhưng BẮT BUỘC có header x-internal-key
@Controller('support/chats/internal')
@UseGuards(InternalApiKeyGuard)
export class ChatInternalController {
  constructor(private readonly personalization: ChatPersonalizationService) {}

  // Tool n8n: Gợi ý cá nhân hóa
  @Public()
  @Get('recommendations')
  async recommend(@Query('sessionId') sessionId: string) {
    if (!sessionId) throw new BadRequestException('sessionId is required');
    return this.personalization.recommendForCustomer(sessionId);
  }

  // Tool n8n: Voucher của khách
  @Public()
  @Get('vouchers')
  async vouchers(@Query('sessionId') sessionId: string) {
    if (!sessionId) throw new BadRequestException('sessionId is required');
    return this.personalization.vouchersForCustomer(sessionId);
  }
}
