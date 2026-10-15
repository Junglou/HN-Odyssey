// Event nội bộ: ChatService nhờ ChatGateway bắn socket
export const CHAT_INTERNAL_EVENTS = {
  EMIT_TO_ROOM: 'chat.emit_to_room',
} as const;

// Event gửi sang NotificationListener (mail + in-app)
export const SUPPORT_EVENTS = {
  HANDOFF_CREATED: 'support.handoff_created',
  CHAT_ACCEPTED: 'support.chat_accepted',
} as const;

// Room chung của tất cả nhân viên đang mở Live Chat Support
export const SUPPORT_AGENTS_ROOM = 'support_agents';

export const CHAT_DEPARTMENT_LABELS: Record<string, string> = {
  SALE: 'Kinh doanh',
  TECH: 'Kỹ thuật',
  SUPPORT: 'CSKH',
};

export interface EmitToRoomPayload {
  room: string;
  event: string;
  data: unknown;
}

export interface HandoffCreatedPayload {
  conversationId: string;
  department: string;
  summary: string;
  customerName: string;
  customerEmail?: string;
}

export interface ChatAcceptedPayload {
  conversationId: string;
  customerEmail: string;
  customerName: string;
  agentName: string;
  department?: string;
}
