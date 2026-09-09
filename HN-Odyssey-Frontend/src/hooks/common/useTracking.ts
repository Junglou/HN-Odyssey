import { useCallback } from "react";
import axiosClient from "../../api/axiosClient";
import tokenStorage from "../../utils/tokenStorage";

// [FIX 1]: Thay thế 'enum' bằng 'const object' + 'type' để pass qua 'erasableSyntaxOnly'
export const BehaviorAction = {
  VIEW_PAGE: "VIEW_PAGE",
  VIEW_PRODUCT: "VIEW_PRODUCT",
  ADD_TO_CART: "ADD_TO_CART",
  CLICK_SEARCH_SUGGESTION: "CLICK_SEARCH_SUGGESTION",
  REVIEW_PRODUCT: "REVIEW_PRODUCT",
} as const;

// Kế thừa type từ const object ở trên
export type BehaviorAction =
  (typeof BehaviorAction)[keyof typeof BehaviorAction];

interface TrackEventPayload {
  action: BehaviorAction;
  path: string;
  dwell_time_seconds?: number;
  metadata?: Record<string, unknown>;
}

// Lấy hoặc tạo Guest Session ID độc lập
const getGuestSessionId = (): string => {
  let sessionId = localStorage.getItem("guestSessionId");
  if (!sessionId) {
    sessionId = `guest_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("guestSessionId", sessionId);
  }
  return sessionId;
};

export function useTracking() {
  const trackEvent = useCallback(async (payload: TrackEventPayload) => {
    try {
      // Ép kiểu chuẩn tránh lỗi TS
      const user = tokenStorage.getUser<{
        _id?: string | { $oid: string };
        id?: string;
      }>();
      let userId: string | undefined = undefined;

      if (user) {
        if (user._id && typeof user._id === "object" && "$oid" in user._id) {
          userId = String(user._id.$oid);
        } else {
          userId = String(user._id || user.id);
        }
      }

      const sessionId = getGuestSessionId();

      await axiosClient.post("/tracking/event", {
        session_id: sessionId,
        user_id: userId,
        action: payload.action,
        path: payload.path || window.location.pathname,
        device: window.innerWidth <= 768 ? "MOBILE" : "DESKTOP",
        dwell_time_seconds: payload.dwell_time_seconds || 1,
        metadata: payload.metadata || {},
      });
      // API Backend thiết kế Non-blocking nên không cần chờ response xử lý
    } catch (error) {
      console.warn("Lỗi gửi tracking ngầm cho AI:", error);
    }
  }, []);

  return { trackEvent };
}
