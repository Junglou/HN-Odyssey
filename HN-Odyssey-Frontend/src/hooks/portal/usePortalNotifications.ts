import { useState, useEffect, useCallback, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axiosClient from "../../api/axiosClient";
import tokenStorage from "../../utils/tokenStorage";

export type NotificationPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type NotificationType =
  | "ORDER"
  | "STOCK"
  | "SYSTEM"
  | "SECURITY"
  | "SUPPORT"
  | "REVIEW"
  | "LOYALTY"
  | "PROMOTION";
export type NotificationFilter = "all" | "unread";

export interface PortalNotification {
  _id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: "OPEN" | "RESOLVED";
  event_code?: string | null;
  occurrence_count: number;
  is_read: boolean;
  createdAt: string;
  last_occurred_at: string;
  metadata?: {
    target_url?: string;
    [key: string]: unknown;
  };
}

type RawNotificationPayload = Partial<PortalNotification> & {
  id?: string;
  _id?: string;
};

const PAGE_SIZE = 20;

const normalize = (raw: RawNotificationPayload): PortalNotification | null => {
  const id = raw._id ?? raw.id;
  if (!id) return null; // Bỏ qua payload không có id (không thể đánh dấu đọc)
  const now = new Date().toISOString();
  return {
    _id: String(id),
    title: raw.title ?? "",
    message: raw.message ?? "",
    type: raw.type ?? "SYSTEM",
    priority: raw.priority ?? "MEDIUM",
    status: raw.status ?? "OPEN",
    event_code: raw.event_code ?? null,
    occurrence_count: raw.occurrence_count ?? 1,
    is_read: Boolean(raw.is_read),
    createdAt: raw.createdAt ?? now,
    last_occurred_at: raw.last_occurred_at ?? raw.createdAt ?? now,
    metadata: raw.metadata ?? {},
  };
};

// Đưa thông báo lên đầu danh sách, không để trùng
const moveToTop = (
  list: PortalNotification[],
  item: PortalNotification,
  keepReadState: boolean,
): PortalNotification[] => {
  const existing = list.find((n) => n._id === item._id);
  const merged =
    existing && keepReadState ? { ...item, is_read: existing.is_read } : item;
  return [merged, ...list.filter((n) => n._id !== item._id)];
};

export function usePortalNotifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const fetchPage = useCallback(
    async (pageToLoad: number, mode: NotificationFilter) => {
      const res = await axiosClient.get("/notifications/my-notifications", {
        params: {
          page: pageToLoad,
          limit: PAGE_SIZE,
          ...(mode === "unread" ? { unread: "true" } : {}),
        },
      });
      const raw: RawNotificationPayload[] = res.data?.success
        ? res.data.data
        : [];
      return raw
        .map(normalize)
        .filter((n): n is PortalNotification => n !== null);
    },
    [],
  );

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await axiosClient.get("/notifications/unread-count");
      if (res.data?.success) setUnreadCount(res.data.data.count);
    } catch {
      // Không toast để tránh làm phiền
    }
  }, []);

  // Tải trang đầu mỗi khi đổi bộ lọc
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const items = await fetchPage(1, filter);
        if (!alive) return;
        setNotifications(items);
        setPage(1);
        setHasMore(items.length === PAGE_SIZE);
      } catch (error) {
        console.error("Lỗi khi tải thông báo:", error);
      } finally {
        if (alive) setIsLoading(false);
      }
      await refreshUnreadCount();
    };
    void run();
    return () => {
      alive = false;
    };
  }, [filter, fetchPage, refreshUnreadCount]);

  const changeFilter = (next: NotificationFilter) => {
    if (next === filter) return;
    setIsLoading(true);
    setNotifications([]);
    setHasMore(true);
    setFilter(next);
  };

  const loadMore = async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    try {
      const nextPage = page + 1;
      const items = await fetchPage(nextPage, filter);
      setNotifications((prev) => {
        const ids = new Set(prev.map((n) => n._id));
        return [...prev, ...items.filter((n) => !ids.has(n._id))];
      });
      setPage(nextPage);
      setHasMore(items.length === PAGE_SIZE);
    } catch (error) {
      console.error("Lỗi khi tải thêm thông báo:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsReadAndNavigate = async (noti: PortalNotification) => {
    if (!noti.is_read) {
      try {
        await axiosClient.patch(`/notifications/${noti._id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n._id === noti._id ? { ...n, is_read: true } : n)),
        );
        void refreshUnreadCount();
      } catch (error) {
        console.error("Lỗi khi đánh dấu đã đọc:", error);
      }
    }
    // Vẫn điều hướng kể cả khi đánh dấu đọc lỗi — người dùng cần tới nơi xử lý
    const targetUrl = noti.metadata?.target_url;
    if (targetUrl) navigate(targetUrl);
  };

  const markAllAsRead = async () => {
    try {
      await axiosClient.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      toast.error("Could not mark notifications as read. Please try again.");
    }
  };

  // Ref để toast (tạo trong effect socket) luôn gọi bản hàm mới nhất
  const openRef = useRef<(n: PortalNotification) => void>(() => {});
  useEffect(() => {
    openRef.current = (n) => {
      void markAsReadAndNavigate(n);
    };
  });

  useEffect(() => {
    if (!tokenStorage.getToken()) return;

    const rawApiUrl =
      import.meta.env.VITE_API_URL || "http://localhost:8080/api";
    const socketBaseUrl = rawApiUrl.replace(/\/api\/?$/, "");

    const socket: Socket = io(`${socketBaseUrl}/notifications`, {
      // Dạng hàm: mỗi lần (re)connect đều đọc token MỚI NHẤT.
      // Access token được refresh giữa chừng thì lần kết nối lại vẫn hợp lệ.
      auth: (cb) => cb({ token: tokenStorage.getToken() }),
    });

    // Chỉ CRITICAL và HIGH mới bật popup; MEDIUM/LOW chỉ vào chuông
    const showToast = (n: PortalNotification) => {
      const text = `${n.title} — ${n.message}`;
      const onClick = () => openRef.current(n);
      if (n.priority === "CRITICAL") {
        toast.error(text, { autoClose: false, onClick });
      } else if (n.priority === "HIGH") {
        toast.warning(text, { autoClose: 5000, onClick });
      }
    };

    socket.on("new_notification", (raw: RawNotificationPayload) => {
      const n = normalize(raw);
      if (!n) return;
      setNotifications((prev) => moveToTop(prev, n, false));
      showToast(n);
      void refreshUnreadCount();
    });

    // Sự kiện lặp lại đã được gộp: cập nhật bộ đếm, đưa lên đầu, KHÔNG popup
    socket.on("notification_updated", (raw: RawNotificationPayload) => {
      const n = normalize(raw);
      if (!n) return;
      setNotifications((prev) => moveToTop(prev, n, true));
    });

    socket.on("notification_resolved", (raw: RawNotificationPayload) => {
      const id = raw._id ?? raw.id;
      if (!id) return;
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, status: "RESOLVED" } : n)),
      );
      void refreshUnreadCount();
    });

    // Đồng bộ giữa các tab / thiết bị của cùng người dùng
    socket.on("notification_read", (data: { id?: string }) => {
      if (!data?.id) return;
      setNotifications((prev) =>
        prev.map((n) => (n._id === data.id ? { ...n, is_read: true } : n)),
      );
      void refreshUnreadCount();
    });

    socket.on("all_notifications_read", () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    });

    // Mất kết nối rồi kết nối lại: lấy lại số chưa đọc cho chắc
    socket.on("connect", () => {
      void refreshUnreadCount();
    });

    return () => {
      socket.disconnect();
    };
  }, [refreshUnreadCount]);

  // Quay lại tab sau một lúc: đồng bộ số chưa đọc
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshUnreadCount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshUnreadCount]);

  return {
    notifications,
    unreadCount,
    hasMore,
    isLoading,
    filter,
    changeFilter,
    loadMore,
    markAsReadAndNavigate,
    markAllAsRead,
  };
}
