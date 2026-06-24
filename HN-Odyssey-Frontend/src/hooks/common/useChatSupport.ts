import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import axiosClient from "../../api/axiosClient";
import tokenStorage from "../../utils/tokenStorage";
import type { UserProfile } from "../../types/user";

// 1. Tách riêng interface cho metadata để dùng chung, loại bỏ hoàn toàn "any"
export interface MessageMetadata {
  fileName?: string;
  fileSize?: string;
  name?: string;
  description?: string;
  link?: string;
  imageUrl?: string;
}

// 2. Gắn chung kiểu MessageMetadata vào UI Message
export interface ChatMessage {
  id: string;
  sender_type: "USER" | "BOT" | "AGENT" | "SYSTEM";
  content: string;
  message_type: "TEXT" | "IMAGE" | "FILE" | "PRODUCT_CARD";
  metadata?: MessageMetadata;
}

// 3. Gắn chung kiểu MessageMetadata vào Server Message
interface ServerMessage {
  _id?: string;
  sender_type: "USER" | "BOT" | "AGENT" | "SYSTEM";
  content: string;
  message_type?: "TEXT" | "IMAGE" | "FILE" | "PRODUCT_CARD";
  metadata?: MessageMetadata;
}

// Định nghĩa kiểu cho cấu hình kết nối Socket
interface SocketConnectionParams {
  path?: string;
  transports: string[];
  auth?: { token: string };
  query?: { token: string };
  extraHeaders?: { Authorization: string };
}

export function useChatSupport() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    // Khởi tạo session ID lưu cục bộ nếu khách chưa từng chat
    let storedSession = localStorage.getItem("chat_session_id");
    if (!storedSession) {
      storedSession =
        "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      localStorage.setItem("chat_session_id", storedSession);
    }
    sessionIdRef.current = storedSession;

    let isMounted = true;

    const initChatAndSocket = async () => {
      try {
        const user = tokenStorage.getUser<UserProfile>();
        const initPayload = {
          sessionId: sessionIdRef.current,
          ...(user?._id && { customerId: user._id }),
        };

        // Bước 1: Khởi tạo hoặc lấy lại phiên chat từ Backend
        const initRes = await axiosClient.post(
          "/support/chats/init",
          initPayload,
        );
        const convId = initRes.data.conversation_id;

        // ĐỒNG BỘ SESSION ID: Cập nhật lại sessionIdRef bằng giá trị BE trả về
        // Giúp tránh lỗi load mảng rỗng khi F5 cho tài khoản đã đăng nhập
        if (initRes.data.session_id) {
          sessionIdRef.current = initRes.data.session_id;
          localStorage.setItem("chat_session_id", initRes.data.session_id);
        }

        if (!isMounted) return;
        setConversationId(convId);

        // Bước 2: Gọi lịch sử tin nhắn bằng sessionIdRef ĐÃ ĐƯỢC ĐỒNG BỘ
        let historyUrl = `/support/chats/session/${sessionIdRef.current}/messages`;

        // Nếu user đã đăng nhập, đính kèm customerId vào URL để Backend nhận diện
        if (user?._id) {
          historyUrl += `?customerId=${user._id}`;
        }

        const historyRes = await axiosClient.get(historyUrl);

        const historyData: ServerMessage[] = historyRes.data || [];

        const formattedHistory: ChatMessage[] = historyData.map(
          (msg: ServerMessage) => ({
            id: msg._id || Date.now().toString(),
            sender_type: msg.sender_type,
            content: msg.content,
            message_type: msg.message_type || "TEXT",
            metadata: msg.metadata,
          }),
        );

        if (isMounted) {
          setMessages(formattedHistory);
        }

        // Bước 3: Cấu hình và kết nối Socket.IO
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

        const socketUrl = `${baseUrl}/chat`;
        const socket = io(socketUrl, socketParams);
        socketRef.current = socket;

        socket.on("connect", () => {
          socket.emit("join_room", { conversationId: convId });

          socket.emit("mark_read", {
            conversation_id: convId,
            user_type: "USER",
          });
        });

        // Lắng nghe tin nhắn mới từ Bot hoặc Agent (Hứng luôn PRODUCT_CARD)
        socket.on("new_message", (newMsg: ServerMessage) => {
          if (!isMounted) return;

          const incomingMsg: ChatMessage = {
            id: newMsg._id || Date.now().toString(),
            sender_type: newMsg.sender_type,
            content: newMsg.content,
            message_type: newMsg.message_type || "TEXT",
            metadata: newMsg.metadata,
          };

          setMessages((prev) => [...prev, incomingMsg]);
        });
      } catch (error) {
        console.error("Khởi tạo hội thoại thất bại:", error);
      }
    };

    initChatAndSocket();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const sendMessage = useCallback(
    (
      content: string,
      message_type: "TEXT" | "IMAGE" | "FILE" = "TEXT",
      metadata?: { fileName?: string; fileSize?: string },
    ) => {
      if (!conversationId || !socketRef.current) return;

      const payload = {
        conversationId,
        content,
        sender_type: "USER",
        message_type,
        metadata,
      };

      socketRef.current.emit("send_message", payload);
    },
    [conversationId],
  );

  return { messages, sendMessage };
}
