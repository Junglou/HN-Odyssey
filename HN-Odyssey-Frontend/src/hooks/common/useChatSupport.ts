import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import axiosClient from "../../api/axiosClient";
import tokenStorage from "../../utils/tokenStorage";
import type { UserProfile } from "../../types/user";
import type { ChatNavigation, ChatProductCard } from "../../types/chatbot";

export interface MessageMetadata {
  fileName?: string;
  fileSize?: string;
  caption?: string; // Chữ khách gõ kèm ảnh
  name?: string;
  description?: string;
  link?: string;
  imageUrl?: string;
  products?: ChatProductCard[]; // Thẻ sản phẩm kiểu mới (tối đa 3)
  navigation?: ChatNavigation; // Bot dẫn tới trang / vị trí trên web
}

export interface ChatMessage {
  id: string;
  conversationId?: string;
  sender_type: "USER" | "BOT" | "AGENT" | "SYSTEM";
  content: string;
  message_type: "TEXT" | "IMAGE" | "FILE" | "PRODUCT_CARD" | "NAVIGATION";
  metadata?: MessageMetadata;
  isLive?: boolean; // Tin nhận realtime (không phải lịch sử) -> mới được tự chuyển trang
}

interface ServerMessage {
  _id?: string;
  conversation_id?: string;
  sender_type: "USER" | "BOT" | "AGENT" | "SYSTEM";
  content: string;
  message_type?: "TEXT" | "IMAGE" | "FILE" | "PRODUCT_CARD" | "NAVIGATION";
  metadata?: MessageMetadata;
}

interface SocketConnectionParams {
  path?: string;
  transports: string[];
  auth?: { token: string };
  query?: { token: string };
  extraHeaders?: { Authorization: string };
}

// Ai đang gõ phía cửa hàng
export type TypingSender = "BOT" | "AGENT";
export interface TypingIndicator {
  senderType: TypingSender;
  userName?: string;
}

interface TypingEventPayload {
  conversation_id: string;
  sender_type: "USER" | "AGENT" | "BOT";
  user_name?: string;
  is_typing: boolean;
}

const SELF_TYPING_IDLE_MS = 2000; // ngừng gõ 2s -> báo "đã ngừng"
const AGENT_TYPING_TIMEOUT_MS = 8000; // phòng mất tín hiệu ngừng gõ
const BOT_TYPING_TIMEOUT_MS = 60000; // n8n có thể trả lời chậm

const toChatMessage = (msg: ServerMessage, isLive = false): ChatMessage => ({
  id: msg._id || `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  sender_type: msg.sender_type,
  content: msg.content,
  message_type: msg.message_type || "TEXT",
  metadata: msg.metadata,
  conversationId: msg.conversation_id,
  isLive,
});

export function useChatSupport() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingIndicator, setTypingIndicator] =
    useState<TypingIndicator | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string>("");
  // Dùng ref để luôn có id mới nhất (kể cả khi server chuyển sang phiên mới)
  const conversationIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selfTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelfTypingRef = useRef(false);

  useEffect(() => {
    let storedSession = localStorage.getItem("chat_session_id");
    if (!storedSession) {
      storedSession =
        "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      localStorage.setItem("chat_session_id", storedSession);
    }
    sessionIdRef.current = storedSession;

    let isMounted = true;

    const hideTyping = () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      setTypingIndicator(null);
    };

    const initChatAndSocket = async () => {
      try {
        const user = tokenStorage.getUser<UserProfile>();
        const initPayload = {
          sessionId: sessionIdRef.current,
          ...(user?._id && { customerId: user._id }),
        };

        // Bước 1: Khởi tạo hoặc lấy lại phiên chat
        const initRes = await axiosClient.post(
          "/support/chats/init",
          initPayload,
        );
        const convId: string = initRes.data.conversation_id;

        if (initRes.data.session_id) {
          sessionIdRef.current = initRes.data.session_id;
          localStorage.setItem("chat_session_id", initRes.data.session_id);
        }

        if (!isMounted) return;
        conversationIdRef.current = convId;

        // Bước 2: Lịch sử tin nhắn
        let historyUrl = `/support/chats/session/${sessionIdRef.current}/messages`;
        if (user?._id) historyUrl += `?customerId=${user._id}`;

        const historyRes = await axiosClient.get(historyUrl);
        const historyData: ServerMessage[] = historyRes.data || [];

        // Lịch sử: isLive = false -> tin NAVIGATION cũ không tự chuyển trang lại
        if (isMounted)
          setMessages(historyData.map((msg) => toChatMessage(msg, false)));

        // Bước 3: Socket.IO
        const rawApiUrl =
          import.meta.env.VITE_API_URL || "https://api.hnodyssey.id.vn/api";
        const baseUrl = rawApiUrl.endsWith("/api")
          ? rawApiUrl.slice(0, -4)
          : rawApiUrl;

        const token = tokenStorage.getToken();
        const socketParams: SocketConnectionParams = {
          path: "/socket.io",
          transports: ["polling", "websocket"],
        };
        if (token) {
          socketParams.auth = { token };
          socketParams.query = { token };
          socketParams.extraHeaders = { Authorization: `Bearer ${token}` };
        }

        const socket = io(`${baseUrl}/chat`, socketParams);
        socketRef.current = socket;

        // Join cả khi reconnect, luôn dùng id mới nhất
        socket.on("connect", () => {
          const currentConvId = conversationIdRef.current;
          if (!currentConvId) return;
          socket.emit("join_room", { conversationId: currentConvId });
          socket.emit("mark_read", {
            conversation_id: currentConvId,
            user_type: "USER",
          });
        });

        socket.on("new_message", (newMsg: ServerMessage) => {
          if (!isMounted) return;
          // Bot/nhân viên đã gửi xong -> tắt "..."
          if (newMsg.sender_type !== "USER") hideTyping();
          setMessages((prev) => [...prev, toChatMessage(newMsg, true)]);
        });

        socket.on("typing", (data: TypingEventPayload) => {
          if (!isMounted) return;
          if (data.sender_type === "USER") return;
          if (data.conversation_id !== conversationIdRef.current) return;

          if (!data.is_typing) {
            hideTyping();
            return;
          }

          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          const senderType: TypingSender =
            data.sender_type === "BOT" ? "BOT" : "AGENT";
          setTypingIndicator({ senderType, userName: data.user_name });
          typingTimeoutRef.current = setTimeout(
            hideTyping,
            senderType === "BOT"
              ? BOT_TYPING_TIMEOUT_MS
              : AGENT_TYPING_TIMEOUT_MS,
          );
        });

        // Phiên cũ đã đóng -> server chuyển sang phiên BOT mới
        socket.on(
          "conversation_switched",
          (data: { conversation_id: string }) => {
            conversationIdRef.current = data.conversation_id;
            socket.emit("join_room", { conversationId: data.conversation_id });
          },
        );
      } catch (error) {
        console.error("Khởi tạo hội thoại thất bại:", error);
      }
    };

    initChatAndSocket();

    return () => {
      isMounted = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (selfTypingTimerRef.current) clearTimeout(selfTypingTimerRef.current);
      socketRef.current?.disconnect();
    };
  }, []);

  // Khách đang gõ -> báo cho nhân viên
  const emitSelfTyping = useCallback((isTyping: boolean) => {
    const socket = socketRef.current;
    const convId = conversationIdRef.current;
    if (!socket || !convId) return;
    socket.emit("typing", {
      conversation_id: convId,
      sender_type: "USER",
      is_typing: isTyping,
    });
  }, []);

  const stopTyping = useCallback(() => {
    if (selfTypingTimerRef.current) clearTimeout(selfTypingTimerRef.current);
    if (isSelfTypingRef.current) {
      isSelfTypingRef.current = false;
      emitSelfTyping(false);
    }
  }, [emitSelfTyping]);

  const notifyTyping = useCallback(() => {
    if (!isSelfTypingRef.current) {
      isSelfTypingRef.current = true;
      emitSelfTyping(true);
    }
    if (selfTypingTimerRef.current) clearTimeout(selfTypingTimerRef.current);
    selfTypingTimerRef.current = setTimeout(() => {
      isSelfTypingRef.current = false;
      emitSelfTyping(false);
    }, SELF_TYPING_IDLE_MS);
  }, [emitSelfTyping]);

  const sendMessage = useCallback(
    (
      content: string,
      message_type: "TEXT" | "IMAGE" | "FILE" = "TEXT",
      metadata?: Pick<MessageMetadata, "fileName" | "fileSize" | "caption">,
    ) => {
      const convId = conversationIdRef.current;
      if (!convId || !socketRef.current) return;

      stopTyping();

      socketRef.current.emit("send_message", {
        conversationId: convId,
        content,
        sender_type: "USER",
        message_type,
        metadata,
        page_context: { current_page: window.location.pathname },
      });
    },
    [stopTyping],
  );

  const getConversationId = useCallback(() => conversationIdRef.current, []);

  return {
    messages,
    sendMessage,
    typingIndicator,
    notifyTyping,
    stopTyping,
    getConversationId,
  };
}
