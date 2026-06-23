import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { io, Socket } from "socket.io-client";
import axiosClient from "../../../../api/axiosClient";
import tokenStorage from "../../../../utils/tokenStorage";

export type ChatStatus = "Waitlist" | "Ongoing" | "Complete";
export type MessageType = "text" | "image" | "product" | "file";

export interface FileData {
  fileName: string;
  fileSize: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderType: "customer" | "consultant" | "system";
  type: MessageType;
  content: string;
  timestamp: string;
  date: string;
  isRead?: boolean;
  productData?: {
    name: string;
    description: string;
    link: string;
    imageUrl: string;
  };
  fileData?: FileData;
}

export interface ChatSession {
  id: string;
  customerId: string;
  customerName: string;
  customerHandle: string;
  customerAvatar?: string;
  departmentTag?: string;
  status: ChatStatus;
  lastMessageTime: string;
  openedAt?: string;
  closedAt?: string;
  messages: ChatMessage[];
  previewText?: string;
}

interface BeCustomer {
  _id: string;
  first_Name?: string;
  last_Name?: string;
  username?: string;
  email: string;
  avatar?: string;
}

export interface MessageMetadata {
  name?: string;
  description?: string;
  link?: string;
  imageUrl?: string;
  fileName?: string;
  fileSize?: string;
  [key: string]: unknown;
}

export interface BeMessage {
  _id?: string;
  conversation_id: string;
  sender_type: "USER" | "BOT" | "AGENT" | "SYSTEM";
  sender_id?: string;
  content: string;
  message_type: "TEXT" | "IMAGE" | "PRODUCT_CARD" | "FILE";
  metadata?: MessageMetadata;
  is_read?: boolean;
  createdAt: string;
}

interface BeConversation {
  _id: string;
  status: "BOT" | "OPEN" | "CLOSED" | "OFFLINE_TICKET";
  session_id: string;
  department_tag?: string;
  customer_id?: BeCustomer;
  latest_message?: BeMessage;
  opened_at?: string;
  closed_at?: string;
  updatedAt: string;
}

interface ServerToClientEvents {
  new_message: (msg: BeMessage) => void;
  typing: (data: { user: string; is_typing: boolean }) => void;
  messages_read: (data: { conversation_id: string; read_by: string }) => void;
  error: (err: { message: string }) => void;
}

interface ClientToServerEvents {
  join_room: (data: { conversationId: string }) => void;
  send_message: (data: {
    conversationId: string;
    content: string;
    sender_type: "AGENT";
    message_type?: string;
    metadata?: Record<string, unknown>;
  }) => void;
  agent_connect: (agentId: string) => void;
  agent_disconnect: (agentId: string) => void;
  typing: (data: {
    conversation_id: string;
    user_name: string;
    is_typing: boolean;
  }) => void;
  mark_read: (data: {
    conversation_id: string;
    user_type: "USER" | "AGENT";
  }) => void;
}

export function useLiveChatSupport() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeTab, setActiveTab] = useState<ChatStatus>("Waitlist");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [tabCounts, setTabCounts] = useState({
    Waitlist: 0,
    Ongoing: 0,
    Complete: 0,
  });

  // STATE PHÂN TRANG VÀ TÌM KIẾM SERVER-SIDE
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const fetchedSessionIds = useRef<Set<string>>(new Set());

  const formatMessage = useCallback((msg: BeMessage): ChatMessage => {
    let senderType: "customer" | "consultant" | "system" = "system";
    if (msg.sender_type === "USER") senderType = "customer";
    if (msg.sender_type === "AGENT" || msg.sender_type === "BOT")
      senderType = "consultant";

    const dateObj = new Date(msg.createdAt);
    const timeString = isNaN(dateObj.getTime())
      ? "Vừa xong"
      : dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateString = isNaN(dateObj.getTime())
      ? "Hôm nay"
      : dateObj.toLocaleDateString("vi-VN");

    const isProduct = msg.message_type === "PRODUCT_CARD";
    const isFile = msg.message_type === "FILE";

    return {
      id: msg._id || `temp_${Date.now()}_${Math.random()}`,
      senderId: msg.sender_id || "unknown",
      senderType,
      type:
        msg.message_type === "IMAGE"
          ? "image"
          : isProduct
            ? "product"
            : isFile
              ? "file"
              : "text",
      content: msg.content,
      timestamp: timeString,
      date: dateString,
      isRead: msg.is_read || false,
      productData:
        isProduct && msg.metadata
          ? {
              name: msg.metadata.name || "Sản phẩm",
              description: msg.metadata.description || "",
              link: msg.metadata.link || "",
              imageUrl: msg.metadata.imageUrl || "",
            }
          : undefined,
      fileData:
        isFile && msg.metadata
          ? {
              fileName: msg.metadata.fileName || "Tệp đính kèm",
              fileSize: msg.metadata.fileSize || "Unknown size",
              url: msg.content,
            }
          : undefined,
    };
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery !== debouncedSearch) {
        setDebouncedSearch(searchQuery);
        setPage(1);
        setHasMore(true);
        setActiveSessionId(null);
        fetchedSessionIds.current.clear();
      }
    }, 500); // Đợi 500ms sau khi ngừng gõ
    return () => clearTimeout(handler);
  }, [searchQuery, debouncedSearch]);

  // 1. KHỞI TẠO SOCKET.IO
  useEffect(() => {
    const token = tokenStorage.getToken();
    const user = tokenStorage.getUser() as {
      id: string;
      fullName?: string;
      email?: string;
    } | null;
    if (!token) return;

    const baseUrl = import.meta.env.VITE_API_URL.split("/api")[0];

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      `${baseUrl}/chat`,
      {
        transports: ["polling", "websocket"],
        auth: { token: token },
        query: { token: token },
        extraHeaders: { Authorization: `Bearer ${token}` },
        reconnection: true,
        reconnectionAttempts: 5,
      },
    );

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      if (user?.id) {
        socket.emit("agent_connect", user.id);
      }
    });

    socket.on("connect_error", (error: Error) => {
      console.error("Socket Connection Error:", error.message);
    });

    socket.on("typing", (data: { user: string; is_typing: boolean }) => {
      setTypingUsers((prev) => ({
        ...prev,
        [data.user]: data.is_typing,
      }));
    });

    socket.on(
      "messages_read",
      (data: { conversation_id: string; read_by: string }) => {
        if (data.read_by === "USER") {
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id === data.conversation_id) {
                return {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.senderType === "consultant" ? { ...m, isRead: true } : m,
                  ),
                };
              }
              return s;
            }),
          );
        }
      },
    );

    // FIX: Tách setTimeout để không render chèn lặp tin nhắn
    socket.on("new_message", (incomingMsg: BeMessage) => {
      setSessions((prev) => {
        const targetSession = prev.find(
          (s) => s.id === incomingMsg.conversation_id,
        );

        if (targetSession && incomingMsg.sender_type === "USER") {
          setTimeout(() => {
            setTypingUsers((tPrev) => ({
              ...tPrev,
              [targetSession.customerName]: false,
            }));
          }, 0);
        }

        return prev.map((s) => {
          if (s.id === incomingMsg.conversation_id) {
            const newMsgFormatted = formatMessage({
              ...incomingMsg,
              createdAt: incomingMsg.createdAt || new Date().toISOString(),
            });

            return {
              ...s,
              messages: [...s.messages, newMsgFormatted],
              lastMessageTime: "Vừa xong",
              previewText:
                incomingMsg.message_type === "IMAGE"
                  ? "[Hình ảnh]"
                  : incomingMsg.message_type === "FILE"
                    ? "[Tệp đính kèm]"
                    : incomingMsg.content,
            };
          }
          return s;
        });
      });
    });

    // EVENT LỖI (CHỐNG SPAM)
    socket.on("error", (err: { message: string }) => {
      toast.error(err.message);
    });

    return () => {
      if (socket) {
        if (user?.id) {
          socket.emit("agent_disconnect", user.id);
        }
        socket.disconnect();
      }
    };
  }, [formatMessage]);

  // 2. FETCH DANH SÁCH HỘI THOẠI (PHÂN TRANG VÀ TÌM KIẾM)
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const user = tokenStorage.getUser() as {
          id: string;
          fullName?: string;
          email?: string;
        } | null;
        const queryParams: {
          limit: number;
          page: number;
          status?: string;
          unassigned?: string;
          agent_id?: string;
          search?: string;
        } = {
          limit: 20, // Load 20 cái mỗi lần
          page: page,
          search: debouncedSearch, // Gửi từ khóa tìm kiếm xuống BE
        };

        if (activeTab === "Waitlist") {
          queryParams.status = "OPEN";
          queryParams.unassigned = "true";
        } else if (activeTab === "Ongoing") {
          queryParams.status = "OPEN";
          queryParams.agent_id = user?.id;
        } else if (activeTab === "Complete") {
          queryParams.status = "CLOSED";
        }

        const res = await axiosClient.get(`/support/chats`, {
          params: queryParams,
        });

        const data: BeConversation[] = res.data?.data || [];
        const meta = res.data?.meta;

        const formattedSessions: ChatSession[] = data.map((conv) => {
          const date = new Date(conv.updatedAt);
          const timeString = isNaN(date.getTime())
            ? ""
            : date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

          if (activeTab !== "Complete") {
            socketRef.current?.emit("join_room", { conversationId: conv._id });
          }

          let preview = conv.latest_message?.content || "Chưa có tin nhắn";
          if (conv.latest_message?.message_type === "IMAGE")
            preview = "[Hình ảnh]";
          if (conv.latest_message?.message_type === "FILE")
            preview = "[Tệp đính kèm]";

          // Ưu tiên username, sau đó tới first_Name + last_Name, rồi tới email
          let displayName = "Khách vãng lai";
          const customer = conv.customer_id;

          if (customer) {
            if (customer.username) {
              displayName = customer.username;
            } else if (customer.first_Name && customer.last_Name) {
              displayName = `${customer.first_Name} ${customer.last_Name}`;
            } else if (customer.email) {
              displayName = customer.email.split("@")[0];
            }
          }

          // Lấy Base URL của Backend (Loại bỏ /api ở đuôi)
          const baseUrl = import.meta.env.VITE_API_URL.replace("/api", "");

          // Xử lý đường dẫn Avatar
          let finalAvatar = undefined;
          if (customer?.avatar) {
            finalAvatar = customer.avatar.startsWith("http")
              ? customer.avatar
              : `${baseUrl}${customer.avatar.startsWith("/") ? "" : "/"}${customer.avatar}`;
          }

          return {
            id: conv._id,
            customerId: customer?._id || conv.session_id,
            customerName: displayName,
            customerHandle:
              customer?.email || `#${conv.session_id.substring(0, 8)}`,
            customerAvatar: finalAvatar,
            departmentTag: conv.department_tag,
            status: activeTab,
            lastMessageTime: timeString,
            openedAt: conv.opened_at
              ? new Date(conv.opened_at).toLocaleString("vi-VN")
              : undefined,
            closedAt: conv.closed_at
              ? new Date(conv.closed_at).toLocaleString("vi-VN")
              : undefined,
            messages: [],
            previewText: preview,
          };
        });

        // XỬ LÝ DỮ LIỆU ĐỔ VỀ DỰA TRÊN TRẠNG THÁI PAGE
        setSessions((prev) =>
          page === 1 ? formattedSessions : [...prev, ...formattedSessions],
        );

        // KIỂM TRA XEM CÒN DỮ LIỆU ĐỂ LOAD NỮA KHÔNG
        if (meta && page >= meta.last_page) {
          setHasMore(false);
        } else if (formattedSessions.length === 0) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        // Chỉ clear nếu đây là Page 1
        if (page === 1) setActiveSessionId(null);
      } catch (error) {
        console.error("Error fetching conversations:", error);
        toast.error("Không thể tải danh sách hội thoại.");
      }
    };

    fetchConversations();
  }, [activeTab, page, debouncedSearch]);

  // 3.1. ĐÁNH DẤU ĐÃ ĐỌC KHI MỞ HỘI THOẠI
  useEffect(() => {
    if (!activeSessionId || !socketRef.current) return;

    socketRef.current.emit("mark_read", {
      conversation_id: activeSessionId,
      user_type: "AGENT",
    });
  }, [activeSessionId]);

  // 3.2. LẤY TIN NHẮN CHI TIẾT
  useEffect(() => {
    if (!activeSessionId) return;
    if (fetchedSessionIds.current.has(activeSessionId)) return;

    fetchedSessionIds.current.add(activeSessionId);

    const fetchMessages = async () => {
      try {
        const res = await axiosClient.get(
          `/support/chats/${activeSessionId}/messages`,
        );
        const beMessages: BeMessage[] = res.data || [];
        const formattedMessages = beMessages.map(formatMessage);

        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, messages: formattedMessages }
              : s,
          ),
        );
      } catch (error) {
        console.error("Error fetching messages:", error);
        toast.error("Lỗi khi tải nội dung tin nhắn.");
      }
    };

    fetchMessages();
  }, [activeSessionId, formatMessage]);

  // 4. LẤY BADGE COUNT
  useEffect(() => {
    const fetchTabCounts = async () => {
      try {
        const res = await axiosClient.get(`/support/chats/analytics`);
        const stats = res.data;
        setTabCounts({
          Waitlist: stats.WaitlistCount || 0,
          Ongoing: stats.OngoingCount || 0,
          Complete: stats.CompleteCount || 0,
        });
      } catch (error) {
        console.error("Lỗi khi lấy số lượng phân bổ trạng thái chat", error);
      }
    };

    fetchTabCounts();
  }, [sessions]);

  // Ghi nhận Active Session
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const actions = {
    changeTab: (tab: ChatStatus) => {
      setActiveTab(tab);
      setSearchQuery("");
      setDebouncedSearch(""); // Force clear từ khóa tìm kiếm ngay lập tức
      setPage(1); // Reset về trang 1
      setHasMore(true); // Mở lại cờ tải thêm
      setActiveSessionId(null); // Bỏ chọn đoạn chat hiện tại
      fetchedSessionIds.current.clear();
    },

    changeSearch: (query: string) => setSearchQuery(query),

    // HÀM LOAD MORE ĐỂ TĂNG PAGE
    loadMore: () => {
      if (hasMore) setPage((prev) => prev + 1);
    },

    selectSession: (sessionId: string) => setActiveSessionId(sessionId),

    acceptConsultant: async (sessionId: string) => {
      try {
        const user = tokenStorage.getUser() as {
          id: string;
          fullName?: string;
          email?: string;
        } | null;
        await axiosClient.patch(
          `/support/chats/${sessionId}/assign`,
          {},
          {
            params: { agentId: user?.id },
          },
        );

        toast.success("Đã nhận tư vấn khách hàng này.");
        setActiveTab("Ongoing");
      } catch (error) {
        console.error("Error accepting consultant:", error);
        toast.error("Lỗi khi nhận tư vấn.");
      }
    },

    completeConsultant: async (sessionId: string) => {
      try {
        await axiosClient.patch(`/support/chats/${sessionId}/close`);
        toast.success("Đã hoàn thành phiên tư vấn.");
        setActiveTab("Complete");
      } catch (error) {
        console.error("Error completing consultant:", error);
        toast.error("Lỗi khi hoàn thành phiên chat.");
      }
    },

    sendMessage: (
      sessionId: string,
      text: string,
      type: "TEXT" | "IMAGE" | "FILE" = "TEXT",
      metadata?: Record<string, unknown>,
    ) => {
      console.log(
        "[sendMessage] sessionId:",
        sessionId,
        "| text:",
        text,
        "| socket:",
        socketRef.current?.id ?? "NULL",
      );
      if (!text.trim() && type === "TEXT") return;
      if (!socketRef.current) {
        console.warn(
          "[sendMessage] Socket chưa connect! Không thể gửi tin nhắn.",
        );
        return;
      }

      socketRef.current.emit("send_message", {
        conversationId: sessionId,
        content: text.trim(),
        sender_type: "AGENT",
        message_type: type,
        metadata: metadata,
      });
    },

    sendTyping: (sessionId: string, isTyping: boolean) => {
      if (!socketRef.current) return;
      const user = tokenStorage.getUser() as {
        id: string;
        fullName?: string;
        email?: string;
      } | null;
      socketRef.current.emit("typing", {
        conversation_id: sessionId,
        user_name: user?.fullName || "Agent",
        is_typing: isTyping,
      });
    },
  };

  return {
    sessions,
    hasMore, // Export hasMore để dùng bên ngoài component UI
    activeTab,
    searchQuery,
    activeSessionId,
    activeSession,
    tabCounts,
    typingUsers,
    actions,
  };
}
