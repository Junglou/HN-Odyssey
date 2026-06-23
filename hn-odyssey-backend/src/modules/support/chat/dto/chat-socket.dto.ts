export class SendMessageDto {
  conversationId: string;
  content: string;
  sender_type?: 'USER' | 'AGENT';
  message_type?: 'TEXT' | 'IMAGE' | 'PRODUCT_CARD' | 'FILE';
  metadata?: Record<string, unknown>;
}

export class TypingDto {
  conversation_id: string;
  user_name: string;
  is_typing: boolean;
}

export interface ChatResponse {
  conversation_id: string;
  sender_type: 'USER' | 'BOT' | 'AGENT'; // Bắt buộc là 1 trong 3 giá trị này
  content: string;
  conversation_status: string;
}
