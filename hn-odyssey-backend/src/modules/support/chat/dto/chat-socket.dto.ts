export class SendMessageDto {
  conversationId: string;
  content: string;
  sender_type?: 'USER' | 'AGENT';
  message_type?: 'TEXT' | 'IMAGE' | 'PRODUCT_CARD' | 'FILE' | 'NAVIGATION';
  metadata?: Record<string, unknown>;
  page_context?: { current_page?: string }; // Trang khách đang xem khi gửi tin
}

export type TypingSenderType = 'USER' | 'AGENT' | 'BOT';

export class TypingDto {
  conversation_id: string;
  sender_type: 'USER' | 'AGENT'; // Client chỉ được gửi 2 loại này, BOT do server tự bắn
  user_name?: string;
  is_typing: boolean;
}

export interface TypingEventPayload {
  conversation_id: string;
  sender_type: TypingSenderType;
  user_name?: string;
  is_typing: boolean;
}

export interface ChatResponse {
  conversation_id: string;
  sender_type: 'USER' | 'BOT' | 'AGENT'; // Bắt buộc là 1 trong 3 giá trị này
  content: string;
  conversation_status: string;
}
