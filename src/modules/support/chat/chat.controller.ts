import {
  Controller,
  Get,
  Query,
  UseGuards,
  Patch,
  Param,
  Post,
  Body,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Resource, Action } from 'src/common/enums/resource.enum';
import { Public } from 'src/common/decorators/public.decorator';

export class FilterConversationDto {
  status?: string;
  limit?: number;
  page?: number;
}

export class InitChatDto {
  sessionId: string; // FE tự random 1 chuỗi lưu vào LocalStorage
  customerId?: string; // Nếu khách đã login thì FE truyền thêm cái này
}

@Controller('support/chats')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // API Khởi tạo hội thoại dành cho Frontend
  @Public()
  @Post('init')
  async initChat(@Body() body: InitChatDto) {
    return this.chatService.initOrGetConversation(
      body.sessionId,
      body.customerId,
    );
  }

  @Get()
  @RequirePermissions(Resource.SUPPORT, Action.READ)
  async getConversations(@Query() query: FilterConversationDto) {
    return this.chatService.findAllConversations(query);
  }

  @Get('analytics')
  @RequirePermissions(Resource.SUPPORT, Action.READ)
  async getAnalytics() {
    // AC14: Trả về các chỉ số AHT, CSAT, Handoff Rate
    return this.chatService.getChatStatistics();
  }

  @Patch(':id/assign')
  @RequirePermissions(Resource.SUPPORT, Action.UPDATE)
  async assignAgent(
    @Param('id') id: string,
    @Query('agentId') agentId: string,
  ) {
    // AC9: Chuyển chat cho nhân viên phù hợp
    return this.chatService.assignToAgent(id, agentId);
  }

  // API dành cho Tool Handoff của n8n
  @Public()
  @Post('handoff')
  async handoffToAgent(
    @Body() body: { sessionId: string; department: string; summary: string },
  ) {
    // Gọi logic cập nhật trạng thái Conversation thành OPEN và gắn tag phòng ban
    return this.chatService.handleHandoffFromBot(
      body.sessionId,
      body.department,
      body.summary,
    );
  }

  // API dành cho Tool Create Ticket của n8n
  @Public()
  @Post('ticket')
  async createTicket(
    @Body() body: { sessionId: string; email: string; content: string },
  ) {
    return this.chatService.createOfflineTicket(
      body.sessionId,
      body.email,
      body.content,
    );
  }

  // AC8: Lấy lịch sử tin nhắn cho khách hàng (Dùng sessionId để nhận diện cả Guest)
  @Public()
  @Get('session/:sessionId/messages')
  async getChatHistory(@Param('sessionId') sessionId: string) {
    return this.chatService.getMessagesBySession(sessionId);
  }

  // AC13: Gửi đánh giá sau hội thoại (CSAT)
  @Public()
  @Patch(':id/csat')
  async submitCsat(
    @Param('id') id: string,
    @Body() dto: { rating: number; comment?: string },
  ) {
    return this.chatService.updateCsat(id, dto);
  }
}
