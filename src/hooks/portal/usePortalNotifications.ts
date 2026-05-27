import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import axiosClient from "../../api/axiosClient";
import { toast } from "react-toastify";

// types
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

// hook
export function usePortalNotifications() {
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // handlers
  const markAsRead = async (id: string) => {
    try {
      const res = await axiosClient.patch(`/notifications/${id}/read`);
      if (res.data && res.data.success) {
        setNotifications((prev) =>
          prev.map((item) =>
            item._id === id ? { ...item, is_read: true } : item,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("lỗi khi cập nhật trạng thái đã đọc:", error);
    }
  };

  // effects
  useEffect(() => {
    let isMounted = true;

    const loadInitialNotifications = async () => {
      try {
        const [res, countRes] = await Promise.all([
          axiosClient.get("/notifications/my-notifications?page=1&limit=20"),
          axiosClient.get("/notifications/unread-count"),
        ]);

        if (isMounted) {
          if (res.data && res.data.success) {
            setNotifications(res.data.data);
          }
          if (countRes.data && countRes.data.success) {
            setUnreadCount(countRes.data.data.count);
          }
        }
      } catch (error) {
        console.error("lỗi khi tải danh sách thông báo:", error);
      }
    };

    loadInitialNotifications();

    return () => {
      isMounted = false;
    };
  }, []);

  // effect
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

    const socket: Socket = io(`${socketUrl}/notifications`, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("new_notification", (data: PortalNotification) => {
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
    markAsRead,
  };
}
