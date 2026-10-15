import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { io, Socket } from "socket.io-client";
import axiosClient from "../../../../api/axiosClient";
import tokenStorage from "../../../../utils/tokenStorage";
import { Action, Resource } from "../../../../types/permissions";
import type { UserPayload } from "../../../../types/auth";
import { getCurrentUser, hasPermission } from "../../../../utils/permission";

export type ChatStatus = "Waitlist" | "Ongoing" | "Complete";
export type MessageType = "text" | "image" | "product" | "file";
export type TypingSender = "USER" | "BOT";

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

export interface TokenUser {
  id?: string;
  _id?: string;
  full_name?: string; // Backend trả về full_name khi login
  fullName?: string;
  email?: string;
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

interface TypingEventPayload {
  conversation_id: string;
  sender_type: "USER" | "AGENT" | "BOT";
  user_name?: string;
  is_typing: boolean;
}

interface ServerToClientEvents {
  new_message: (msg: BeMessage) => void;
  typing: (data: TypingEventPayload) => void;
  messages_read: (data: { conversation_id: string; read_by: string }) => void;
  new_waitlist: (data: { conversation_id: string; department: string }) => void;
  conversation_assigned: (data: {
    conversation_id: string;
    agent_id: string;
  }) => void;
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
    sender_type: "AGENT";
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
  // key = conversation_id, value = ai đang gõ trong hội thoại đó
  const [typingUsers, setTypingUsers] = useState<
    Record<string, TypingSender | null>
  >({});
  const [countsVersion, setCountsVersion] = useState(0); // tăng để fetch lại badge
  const activeTabRef = useRef<ChatStatus>("Waitlist"); // dùng trong listener socket
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  const [tabCounts, setTabCounts] = useState({
    Waitlist: 0,
    Ongoing: 0,
    Complete: 0,
  });

  // Đọc user qua tokenStorage (key "user_info") bằng helper dùng chung của portal
  const [user] = useState(() => getCurrentUser<UserPayload>());

  const canReadChat = hasPermission(user, Resource.CRM_CHAT, Action.READ);
  const canAssignChat = hasPermission(user, Resource.CRM_CHAT, Action.ASSIGN);
  const canReplyChat = hasPermission(user, Resource.CRM_CHAT, Action.REPLY);
  const canUpdateChat = hasPermission(user, Resource.CRM_CHAT, Action.UPDATE);

  // STATE PHÂN TRANG VÀ TÌM KIẾM SERVER-SIDE
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const fetchedSessionIds = useRef<Set<string>>(new Set());
  // Các room đã join -> join lại khi socket reconnect
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  const joinRoom = useCallback((conversationId: string) => {
    joinedRoomsRef.current.add(conversationId);
    socketRef.current?.emit("join_room", { conversationId });
  }, []);

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

  const fetchSingleConversationAndAppend = async (convId: string) => {
    try {
      // Gọi API lấy page 1 của các đoạn chat đang OPEN (Đoạn chat mới có tương tác sẽ luôn trồi lên đầu DB)
      const res = await axiosClient.get(`/support/chats`, {
        params: { limit: 20, page: 1, status: "OPEN" },
      });

      const data: BeConversation[] = res.data?.data || [];
      const newConv = data.find((c) => c._id === convId);

      if (newConv) {
        joinRoom(newConv._id); // để nhận tin nhắn + typing của khách mới
        const date = new Date(newConv.updatedAt);
        const timeString = isNaN(date.getTime())
          ? ""
          : date.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

        let preview = newConv.latest_message?.content || "Chưa có tin nhắn";
        if (newConv.latest_message?.message_type === "IMAGE")
          preview = "[Hình ảnh]";
        if (newConv.latest_message?.message_type === "FILE")
          preview = "[Tệp đính kèm]";

        let displayName = "Khách vãng lai";
        const customer = newConv.customer_id;
        if (customer) {
          if (customer.username) displayName = customer.username;
          else if (customer.first_Name && customer.last_Name)
            displayName = `${customer.first_Name} ${customer.last_Name}`;
          else if (customer.email) displayName = customer.email.split("@")[0];
        }

        const baseUrl = import.meta.env.VITE_API_URL.replace("/api", "");
        let finalAvatar = undefined;
        if (customer?.avatar) {
          finalAvatar = customer.avatar.startsWith("http")
            ? customer.avatar
            : `${baseUrl}${customer.avatar.startsWith("/") ? "" : "/"}${customer.avatar}`;
        }

        const newSession: ChatSession = {
          id: newConv._id,
          customerId: customer?._id || newConv.session_id,
          customerName: displayName,
          customerHandle:
            customer?.email || `#${newConv.session_id.substring(0, 8)}`,
          customerAvatar: finalAvatar,
          departmentTag: newConv.department_tag,
          status: "Waitlist", // Đoạn chat mới luôn đưa vào Waitlist
          lastMessageTime: timeString,
          openedAt: newConv.opened_at
            ? new Date(newConv.opened_at).toLocaleString("vi-VN")
            : undefined,
          closedAt: undefined,
          messages: [], // Lịch sử sẽ tự động fetch khi click vào
          previewText: preview,
        };

        // Đẩy đoạn chat mới tinh này lên vị trí ĐẦU TIÊN của danh sách hiện tại
        setSessions((prev) => {
          // Double check để tránh bị trùng lặp nếu API gọi 2 lần
          if (prev.some((s) => s.id === convId)) return prev;
          return [newSession, ...prev];
        });
      }
    } catch (error) {
      console.error("Lỗi khi tải bổ sung thông tin hội thoại mới:", error);
    }
  };

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
    // FIX 1: Lấy as any để linh hoạt bắt cả id hoặc _id
    const user = tokenStorage.getUser() as TokenUser | null;

    // Bắt gọn ID nhân viên bất kể cấu trúc API trả về là gì
    const agentId = user?.id || user?._id;

    if (!token) return;

    // FIX 2: Xử lý URL Socket chuẩn xác, an toàn tuyệt đối, có fallback
    const rawApiUrl =
      import.meta.env.VITE_API_URL || "http://localhost:8080/api";
    const baseUrl = rawApiUrl.endsWith("/api")
      ? rawApiUrl.slice(0, -4)
      : rawApiUrl;

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
      console.log("Socket connected thành công:", socket.id);
      if (agentId) {
        socket.emit("agent_connect", agentId);
      }
      // Reconnect: server đã mất room cũ -> join lại
      joinedRoomsRef.current.forEach((conversationId) => {
        socket.emit("join_room", { conversationId });
      });
    });

    socket.on("connect_error", (error: Error) => {
      console.error("Socket Connection Error:", error.message);
    });

    const typingTimers = typingTimersRef.current;

    socket.on("typing", (data: TypingEventPayload) => {
      if (data.sender_type === "AGENT") return; // bỏ qua nhân viên khác
      const convId = data.conversation_id;
      const sender: TypingSender = data.sender_type === "BOT" ? "BOT" : "USER";

      if (typingTimers[convId]) clearTimeout(typingTimers[convId]);
      setTypingUsers((prev) => ({
        ...prev,
        [convId]: data.is_typing ? sender : null,
      }));

      if (data.is_typing) {
        // Phòng mất tín hiệu "ngừng gõ"
        typingTimers[convId] = setTimeout(
          () => setTypingUsers((prev) => ({ ...prev, [convId]: null })),
          sender === "BOT" ? 60000 : 8000,
        );
      }
    });

    // Bot vừa chuyển khách sang nhân viên
    socket.on("new_waitlist", (data) => {
      toast.info(`Có khách đang chờ hỗ trợ (bộ phận ${data.department})`);
      setCountsVersion((v) => v + 1);
      if (activeTabRef.current === "Waitlist") {
        fetchSingleConversationAndAppend(data.conversation_id);
      }
    });

    // Một nhân viên khác vừa nhận khách -> gỡ khỏi Waitlist của mình
    socket.on("conversation_assigned", (data) => {
      setCountsVersion((v) => v + 1);
      if (data.agent_id === agentId) return;
      if (activeTabRef.current === "Waitlist") {
        setSessions((prev) =>
          prev.filter((s) => s.id !== data.conversation_id),
        );
        setActiveSessionId((cur) =>
          cur === data.conversation_id ? null : cur,
        );
      }
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

    socket.on("new_message", async (incomingMsg: BeMessage) => {
      // 1. Kiểm tra xem hội thoại này đã có trong state chưa
      setSessions((prev) => {
        const isExist = prev.some((s) => s.id === incomingMsg.conversation_id);

        // NẾU CHƯA CÓ TRÊN MÀN HÌNH -> FETCH BỔ SUNG NGAY LẬP TỨC
        if (!isExist) {
          // Gọi một hàm độc lập bên ngoài để fetch dữ liệu 1 conversation và append vào Waitlist
          fetchSingleConversationAndAppend(incomingMsg.conversation_id);
          return prev; // Tạm thời trả về mảng cũ trong lúc đợi fetch
        }

        // NẾU ĐÃ CÓ RỒI THÌ LÀM NHƯ CŨ
        if (
          incomingMsg.sender_type === "USER" ||
          incomingMsg.sender_type === "BOT"
        ) {
          setTimeout(() => {
            setTypingUsers((tPrev) => ({
              ...tPrev,
              [incomingMsg.conversation_id]: null,
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

    socket.on("error", (err: { message: string }) => {
      toast.error(err.message);
    });

    return () => {
      Object.values(typingTimers).forEach((t) => clearTimeout(t));
      if (socket) {
        if (agentId) {
          socket.emit("agent_disconnect", agentId);
        }
        socket.disconnect();
      }
    };
  }, [formatMessage]);

  // 2. FETCH DANH SÁCH HỘI THOẠI (PHÂN TRANG VÀ TÌM KIẾM)
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const user = tokenStorage.getUser() as TokenUser | null;
        const agentId = user?.id || user?._id;
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
          queryParams.agent_id = agentId;
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
            joinRoom(conv._id);
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
        if (page === 1) {
          setActiveSessionId(null);
          fetchedSessionIds.current.clear();
        }
      } catch (error) {
        console.error("Error fetching conversations:", error);
        toast.error("Không thể tải danh sách hội thoại.");
      }
    };

    fetchConversations();
  }, [activeTab, page, debouncedSearch, joinRoom]);

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
  }, [sessions, countsVersion]);

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
      if (!canAssignChat)
        return toast.error("Bạn không có quyền nhận hội thoại.");
      try {
        const user = tokenStorage.getUser() as TokenUser | null;
        const agentId = user?.id || user?._id;
        await axiosClient.patch(
          `/support/chats/${sessionId}/assign`,
          {},
          {
            params: { agentId: agentId },
          },
        );

        toast.success("Đã nhận tư vấn khách hàng này.");
        actions.changeTab("Ongoing"); // reset page + cache tin nhắn giống bấm tab thủ công
      } catch (error) {
        console.error("Error accepting consultant:", error);
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        if (status === 409) {
          toast.warning("Hội thoại này đã được nhân viên khác tiếp nhận.");
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          setActiveSessionId(null);
          setCountsVersion((v) => v + 1);
          return;
        }
        toast.error("Lỗi khi nhận tư vấn.");
      }
    },

    completeConsultant: async (sessionId: string) => {
      if (!canUpdateChat)
        return toast.error("Bạn không có quyền kết thúc hội thoại.");
      try {
        await axiosClient.patch(`/support/chats/${sessionId}/close`);
        toast.success("Đã hoàn thành phiên tư vấn.");
        actions.changeTab("Complete");
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
      if (!canReplyChat) return toast.error("Bạn không có quyền gửi tin nhắn.");
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

      const user = tokenStorage.getUser() as TokenUser | null;

      socketRef.current.emit("typing", {
        conversation_id: sessionId,
        sender_type: "AGENT",
        user_name: user?.full_name || user?.fullName || "Nhân viên",
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
    permissions: { canReadChat, canAssignChat, canReplyChat, canUpdateChat },
  };
}
