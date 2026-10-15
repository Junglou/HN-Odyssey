import { Logger, UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { SendMessageDto, TypingDto } from './dto/chat-socket.dto';
import type { TypingEventPayload } from './dto/chat-socket.dto';
import { WsJwtGuard } from 'src/common/guards/ws-jwt.guard';
import { CHAT_INTERNAL_EVENTS, SUPPORT_AGENTS_ROOM } from './chat.events';
import type { EmitToRoomPayload } from './chat.events';

interface AgentSocketData {
  agentId?: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'chat',
})
@UseGuards(WsJwtGuard)
export class ChatGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);
  constructor(private readonly chatService: ChatService) {}

  // 0. NHẬN YÊU CẦU BẮN SOCKET TỪ ChatService (assign / close / handoff)
  @OnEvent(CHAT_INTERNAL_EVENTS.EMIT_TO_ROOM)
  handleInternalEmit(payload: EmitToRoomPayload) {
    this.server.to(payload.room).emit(payload.event, payload.data);
  }

  // Socket rớt (đóng tab, mất mạng) -> gỡ nhân viên khỏi danh sách online
  handleDisconnect(client: Socket) {
    const socketData = client.data as AgentSocketData | undefined;
    if (socketData?.agentId) {
      this.chatService.removeAgentSocket(socketData.agentId, client.id);
      this.logger.log(
        `Agent ${socketData.agentId} mất kết nối (socket ${client.id}).`,
      );
    }
  }

  // 1. USER/AGENT JOIN VÀO PHÒNG CHAT
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.conversationId) return;
    await client.join(data.conversationId);
    this.logger.log(`Client ${client.id} joined room: ${data.conversationId}`);
  }

  // 2. GỬI TIN NHẮN
  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    if (this.chatService.checkSpam(client.id)) {
      client.emit('error', { message: 'Tạm khóa 10 giây để chống Spam.' });
      return;
    }

    const userMsg = await this.chatService.processUserMessage(data);

    if (!userMsg) {
      client.emit('error', {
        message:
          'Không thể gửi tin nhắn: phiên chat không tồn tại hoặc đã kết thúc.',
      });
      return;
    }

    const roomId = userMsg.conversation_id;

    // Phiên cũ đã CLOSED -> Service đã chuyển tin nhắn sang phiên BOT mới
    if (userMsg.switched_from) {
      await client.join(roomId);
      client.emit('conversation_switched', {
        old_conversation_id: userMsg.switched_from,
        conversation_id: roomId,
      });
    }

    this.server.to(roomId).emit('new_message', userMsg);

    // Chỉ khi KHÁCH nhắn và phiên đang ở chế độ BOT thì mới gọi AI
    if (
      userMsg.sender_type === 'USER' &&
      userMsg.conversation_status === 'BOT'
    ) {
      this.emitTyping(roomId, 'BOT', true);
      try {
        const botReply = await this.chatService.getBotResponse({
          ...data,
          conversationId: roomId,
        });
        this.server.to(roomId).emit('new_message', botReply);
      } finally {
        this.emitTyping(roomId, 'BOT', false);
      }
    }
  }

  private emitTyping(
    room: string,
    senderType: TypingEventPayload['sender_type'],
    isTyping: boolean,
  ) {
    const payload: TypingEventPayload = {
      conversation_id: room,
      sender_type: senderType,
      user_name: senderType === 'BOT' ? 'Trợ lý ảo' : undefined,
      is_typing: isTyping,
    };
    this.server.to(room).emit('typing', payload);
  }

  // 3. KHÁCH / NHÂN VIÊN ĐANG GÕ
  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: TypingDto,
    @ConnectedSocket() client: Socket,
  ): void {
    if (!data?.conversation_id) return;

    // Không cho client giả danh BOT
    const senderType = data.sender_type === 'AGENT' ? 'AGENT' : 'USER';

    const payload: TypingEventPayload = {
      conversation_id: data.conversation_id,
      sender_type: senderType,
      user_name: data.user_name,
      is_typing: !!data.is_typing,
    };

    client.broadcast.to(data.conversation_id).emit('typing', payload);
  }

  // 4. NHÂN VIÊN ONLINE / OFFLINE
  @SubscribeMessage('agent_connect')
  async handleAgentConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() agentId: string,
  ) {
    if (!agentId) return;
    (client.data as AgentSocketData).agentId = agentId;
    this.chatService.addAgentSocket(agentId, client.id);
    await client.join(SUPPORT_AGENTS_ROOM);
    this.logger.log(`Agent ${agentId} is now online (socket ${client.id}).`);
  }

  @SubscribeMessage('agent_disconnect')
  handleAgentDisconnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() agentId: string,
  ) {
    if (!agentId) return;
    this.chatService.removeAgentSocket(agentId, client.id);
    (client.data as AgentSocketData).agentId = undefined;
    this.logger.log(`Agent ${agentId} is now offline (socket ${client.id}).`);
  }

  // 5. ĐÁNH DẤU ĐÃ ĐỌC
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

    client.broadcast.to(data.conversation_id).emit('messages_read', {
      conversation_id: data.conversation_id,
      read_by: data.user_type,
    });
  }
}
