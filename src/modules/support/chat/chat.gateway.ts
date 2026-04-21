import { Logger, UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { SendMessageDto, TypingDto } from './dto/chat-socket.dto';
import { WsJwtGuard } from 'src/common/guards/ws-jwt.guard';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'chat',
})
@UseGuards(WsJwtGuard)
export class ChatGateway {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);
  constructor(private readonly chatService: ChatService) {}

  // 1. THÊM EVENT NÀY ĐỂ USER/AGENT JOIN VÀO PHÒNG CHAT
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    await client.join(conversationId);
    this.logger.log(`Client ${client.id} joined room: ${conversationId}`);
  }

  // 2. LOGIC GỬI TIN NHẮN
  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    if (this.chatService.checkSpam(client.id)) {
      client.emit('error', { message: 'Tạm khóa 10 giây để chống Spam.' });
      return;
    }

    // Xử lý và lưu tin nhắn
    const userMsg = await this.chatService.processUserMessage(data);

    // ĐỔI client.emit THÀNH server.to().emit ĐỂ GỬI CHO CẢ USER LẪN AGENT TRONG PHÒNG
    this.server.to(data.conversationId).emit('new_message', userMsg);

    // Nếu đang ở trạng thái BOT, gọi AI và gửi lại cho phòng
    if (userMsg.conversation_status === 'BOT') {
      const botReply = await this.chatService.getBotResponse(data);
      this.server.to(data.conversationId).emit('new_message', botReply);
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: TypingDto,
    @ConnectedSocket() client: Socket,
  ): void {
    // Phát tín hiệu cho những người khác trong cùng hội thoại
    client.broadcast.to(data.conversation_id).emit('typing', {
      user: data.user_name,
      is_typing: data.is_typing,
    });
  }

  @SubscribeMessage('agent_connect')
  handleAgentConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() agentId: string,
  ) {
    this.chatService.onlineAgents.add(agentId);
    this.logger.log(`Agent ${agentId} is now online.`);
  }

  @SubscribeMessage('agent_disconnect')
  handleAgentDisconnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() agentId: string,
  ) {
    this.chatService.onlineAgents.delete(agentId);
    this.logger.log(`Agent ${agentId} is now offline.`);
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @MessageBody()
    data: { conversation_id: string; user_type: 'USER' | 'AGENT' },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    await this.chatService.markMessagesAsRead(
      data.conversation_id,
      data.user_type,
    );

    // Báo cho bên kia biết tin nhắn đã được xem
    client.broadcast.to(data.conversation_id).emit('messages_read', {
      conversation_id: data.conversation_id,
      read_by: data.user_type,
    });
  }
}
