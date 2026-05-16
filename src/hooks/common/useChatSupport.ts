import { useState } from "react";

// interfaces
export interface ChatMessage {
  id: string;
  sender_type: "USER" | "BOT" | "AGENT" | "SYSTEM";
  content: string;
  message_type: "TEXT" | "IMAGE" | "FILE" | "PRODUCT_CARD";
  metadata?: {
    fileName?: string;
    fileSize?: string;
    // Dành cho PRODUCT_CARD sau này (nếu có thêm):
    // productId?: string;
    // productName?: string;
  };
}

// mock data
const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    sender_type: "USER",
    content: "This is a sample test message",
    message_type: "TEXT",
  },
  {
    id: "m2",
    sender_type: "BOT",
    content: "This is a sample test message",
    message_type: "TEXT",
  },
  {
    id: "m3",
    sender_type: "BOT",
    content: "https://placehold.co/300x150/png",
    message_type: "IMAGE",
  },
  {
    id: "m4",
    sender_type: "USER",
    content: "File đính kèm",
    message_type: "FILE",
    metadata: {
      fileName: "Attachment.pdf",
      fileSize: "35.9mb",
    },
  },
];

// hook
export function useChatSupport() {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);

  // TODO: Khởi tạo socket.io-client và API initChat ở đây trong useEffect

  const sendMessage = (text: string) => {
    // 1. Cập nhật UI ngay lập tức (Optimistic UI)
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender_type: "USER",
      content: text,
      message_type: "TEXT",
    };
    setMessages((prev) => [...prev, newMsg]);

    // TODO: 2. Emit sự kiện socket 'send_message' xuống Backend
    // socket.emit('send_message', { conversationId: '...', content: text });
  };

  return {
    messages,
    sendMessage,
  };
}
