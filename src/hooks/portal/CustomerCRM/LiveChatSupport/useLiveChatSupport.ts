import { useState, useMemo } from "react";
import { toast } from "react-toastify";

// định nghĩa các kiểu dữ liệu cho module chat
export type ChatStatus = "Waitlist" | "Ongoing" | "Complete";
export type MessageType = "text" | "image" | "product";

export interface ChatMessage {
  id: string;
  senderId: string; // 'system', 'customer', hoặc id của tư vấn viên
  senderType: "customer" | "consultant" | "system";
  type: MessageType;
  content: string;
  timestamp: string;
  productData?: {
    name: string;
    description: string;
    link: string;
    imageUrl: string;
  };
}

export interface ChatSession {
  id: string;
  customerId: string;
  customerName: string;
  customerHandle: string;
  customerAvatar?: string;
  status: ChatStatus;
  lastMessageTime: string;
  messages: ChatMessage[];
}

// dữ liệu mẫu giả lập các phiên chat
const MOCK_SESSIONS: ChatSession[] = [
  {
    id: "session_1",
    customerId: "cust_1",
    customerName: "Customer account id",
    customerHandle: "@customerhandle",
    status: "Waitlist",
    lastMessageTime: "5m",
    messages: [
      {
        id: "msg_1",
        senderId: "cust_1",
        senderType: "customer",
        type: "text",
        content: "I need help with my recent order.",
        timestamp: "10:15 pm",
      },
    ],
  },
  {
    id: "session_2",
    customerId: "cust_2",
    customerName: "Alex Johnson",
    customerHandle: "@alexj",
    status: "Ongoing",
    lastMessageTime: "2m",
    messages: [
      {
        id: "msg_2",
        senderId: "cust_2",
        senderType: "customer",
        type: "text",
        content: "This is a sample test message",
        timestamp: "10:15 pm",
      },
      {
        id: "msg_3",
        senderId: "cust_2",
        senderType: "customer",
        type: "image",
        content: "https://via.placeholder.com/300x200?text=Product+Image",
        timestamp: "10:15 pm",
      },
      {
        id: "msg_4",
        senderId: "cons_1",
        senderType: "consultant",
        type: "text",
        content: "This is a sample test message",
        timestamp: "12:15 pm",
      },
      {
        id: "msg_5",
        senderId: "cons_1",
        senderType: "consultant",
        type: "product",
        content: "Ration kit 1",
        timestamp: "12:15 pm",
        productData: {
          name: "Ration kit 1",
          description:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit...",
          link: "shop.com",
          imageUrl: "https://via.placeholder.com/300x200?text=Ration+Kit",
        },
      },
    ],
  },
  {
    id: "session_3",
    customerId: "cust_3",
    customerName: "Maria Garcia",
    customerHandle: "@mariag",
    status: "Complete",
    lastMessageTime: "1h",
    messages: [
      {
        id: "msg_6",
        senderId: "cust_3",
        senderType: "customer",
        type: "text",
        content: "Thank you for the support!",
        timestamp: "09:00 am",
      },
    ],
  },
];

export function useLiveChatSupport() {
  const [sessions, setSessions] = useState<ChatSession[]>(MOCK_SESSIONS);
  const [activeTab, setActiveTab] = useState<ChatStatus>("Waitlist");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // lọc danh sách chat theo tab trạng thái và từ khóa tìm kiếm
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchStatus = session.status === activeTab;
      const matchSearch =
        session.customerName
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        session.customerHandle
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [sessions, activeTab, searchQuery]);

  // lấy chi tiết đoạn chat đang được chọn
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const actions = {
    // chuyển đổi tab trạng thái
    changeTab: (tab: ChatStatus) => {
      setActiveTab(tab);
      setActiveSessionId(null); // Reset chat đang chọn khi đổi tab
    },

    // cập nhật từ khóa tìm kiếm
    changeSearch: (query: string) => setSearchQuery(query),

    // chọn một đoạn chat để xem chi tiết
    selectSession: (sessionId: string) => setActiveSessionId(sessionId),

    // chuyển trạng thái từ Waitlist sang Ongoing (nhận tư vấn)
    acceptConsultant: (sessionId: string) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: "Ongoing" } : s)),
      );
      toast.success("Đã nhận tư vấn khách hàng này.");
      setActiveTab("Ongoing");
    },

    // chuyển trạng thái từ Ongoing sang Complete (hoàn thành)
    completeConsultant: (sessionId: string) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, status: "Complete" } : s,
        ),
      );
      toast.success("Đã hoàn thành phiên tư vấn.");
      setActiveTab("Complete");
    },

    // gửi tin nhắn mới (chỉ demo gửi text)
    sendMessage: (sessionId: string, text: string) => {
      if (!text.trim()) return;

      const newMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        senderId: "cons_current", // giả định ID của tư vấn viên hiện tại
        senderType: "consultant",
        type: "text",
        content: text.trim(),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: [...s.messages, newMessage],
                lastMessageTime: "Just now",
              }
            : s,
        ),
      );
    },
  };

  return {
    sessions,
    filteredSessions,
    activeTab,
    searchQuery,
    activeSessionId,
    activeSession,
    actions,
  };
}
