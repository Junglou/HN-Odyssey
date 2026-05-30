import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { toast } from "react-toastify";

export interface PortalNotification {
  _id: string;
  title: string;
  message: string;
  type: "ORDER" | "STOCK" | "SYSTEM" | "SECURITY" | "LOYALTY" | "PROMOTION";
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  is_read: boolean;
  createdAt: string;
  metadata?: {
    order_id?: string;
    sku?: string;
    target_url?: string;
    area_code?: string;
  };
}
export interface RawNotificationPayload extends Omit<
  PortalNotification,
  "_id" | "is_read"
> {
  id?: string;
  _id?: string;
  is_read?: boolean;
}

export function usePortalNotifications() {
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const loadMore = async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    const nextPage = page + 1;
    try {
      const res = await axiosClient.get(
        `/notifications/my-notifications?page=${nextPage}&limit=20`,
      );
      if (res.data && res.data.success) {
        const newItems = res.data.data;
        setNotifications((prev) => [...prev, ...newItems]);
        setPage(nextPage);

        // khóa trạng thái tải thêm nếu dữ liệu trả về không đủ limit
        if (newItems.length < 20) {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error("lỗi khi tải thêm thông báo:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsReadAndNavigate = async (id: string, targetUrl?: string) => {
    try {
      const res = await axiosClient.patch(`/notifications/${id}/read`);
      if (res.data && res.data.success) {
        setNotifications((prev) =>
          prev.map((item) =>
            item._id === id ? { ...item, is_read: true } : item,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        // thực thi chuyển trang nếu dữ liệu metadata có định tuyến
        if (targetUrl) {
          navigate(targetUrl);
        }
      }
    } catch (error) {
      console.error("lỗi khi cập nhật trạng thái đã đọc:", error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const [res, countRes] = await Promise.all([
          axiosClient.get("/notifications/my-notifications?page=1&limit=20"),
          axiosClient.get("/notifications/unread-count"),
        ]);

        if (isMounted) {
          if (res.data && res.data.success) {
            setNotifications(res.data.data);
            if (res.data.data.length < 20) {
              setHasMore(false);
            }
          }
          if (countRes.data && countRes.data.success) {
            setUnreadCount(countRes.data.data.count);
          }
        }
      } catch (error) {
        console.error("lỗi khi tải dữ liệu khởi tạo:", error);
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";

    const socket: Socket = io(`${socketUrl}/notifications`, {
      auth: { token },
      transports: ["websocket"],
    });

    // map lại raw payload để lấy id đồng bộ với logic _id của frontend
    socket.on("new_notification", (rawPayload: RawNotificationPayload) => {
      // trích xuất id an toàn bằng toán tử nullish coalescing
      const safeId = rawPayload.id ?? rawPayload._id;

      const data: PortalNotification = {
        ...rawPayload,
        _id: safeId ? String(safeId) : "",
        is_read: Boolean(rawPayload.is_read),
      };

      setNotifications((prev) => [data, ...prev]);
      setUnreadCount((prev) => prev + 1);
      toast.info(`thông báo mới: ${data.title}`);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    notifications,
    unreadCount,
    hasMore,
    isLoading,
    loadMore,
    markAsReadAndNavigate,
  };
}
