import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../api/axiosClient";
import { useProfileManagement, type ProfileUser } from "./useProfileManagement";

interface LoyaltyMyInfoApi {
  points?: number;
  tier?: string;
  total_spent?: number;
  progress?: {
    current_tier?: string;
    next_tier?: string | null;
    amount_needed?: number;
  };
  pending_points?: number;
  expiring_soon_points?: number;
}

interface LoyaltyHistoryApi {
  _id?: string;
  amount?: number;
  description?: string;
  type?: string;
  order_id?: string;
  createdAt?: string;
}

export interface LoyaltyInfo {
  points: number;
  tier: string;
  totalSpent: number;
  progress: {
    currentTier: string;
    nextTier: string | null;
    amountNeeded: number;
  };
  pendingPoints: number;
  expiringSoonPoints: number;
}

export interface LoyaltyHistoryItem {
  id: string;
  amount: number;
  description: string;
  type: string;
  orderId?: string;
  createdAt: string;
}

const mapInfoFromApi = (
  raw: LoyaltyMyInfoApi,
  profile: ProfileUser,
): LoyaltyInfo => ({
  points: Number(raw.points ?? profile.loyalty.point),
  tier: String(raw.tier ?? profile.loyalty.tier),
  totalSpent: Number(raw.total_spent ?? profile.loyalty.total_spent),
  progress: {
    currentTier: String(
      raw.progress?.current_tier ?? raw.tier ?? profile.loyalty.tier,
    ),
    nextTier: raw.progress?.next_tier ?? null,
    amountNeeded: Number(raw.progress?.amount_needed ?? 0),
  },
  pendingPoints: Number(raw.pending_points ?? 0),
  expiringSoonPoints: Number(raw.expiring_soon_points ?? 0),
});

const mapInfoFromProfile = (profile: ProfileUser): LoyaltyInfo => ({
  points: profile.loyalty.point,
  tier: profile.loyalty.tier,
  totalSpent: profile.loyalty.total_spent,
  progress: {
    currentTier: profile.loyalty.tier,
    nextTier: null,
    amountNeeded: 0,
  },
  pendingPoints: 0,
  expiringSoonPoints: 0,
});

const mapHistoryFromApi = (
  raw: LoyaltyHistoryApi,
  index: number,
): LoyaltyHistoryItem => ({
  id: raw._id ? String(raw._id) : `history-${index}`,
  amount: Number(raw.amount ?? 0),
  description: String(raw.description ?? ""),
  type: String(raw.type ?? ""),
  orderId: raw.order_id ? String(raw.order_id) : undefined,
  createdAt: String(raw.createdAt ?? ""),
});

export function useLoyaltyManagement() {
  const { user } = useProfileManagement();
  // Dữ liệu thô từ API loyalty; null = chưa tải xong hoặc tải lỗi
  const [apiInfo, setApiInfo] = useState<LoyaltyMyInfoApi | null>(null);
  const [history, setHistory] = useState<LoyaltyHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Không phụ thuộc user -> chỉ gọi API 1 lần khi mở trang
  const fetchLoyalty = useCallback(async () => {
    setLoading(true);
    try {
      const [infoRes, historyRes] = await Promise.all([
        axiosClient.get("/loyalty/my-info"),
        axiosClient.get("/loyalty/history", {
          params: { page: 1, limit: 10 },
        }),
      ]);

      const infoRaw: LoyaltyMyInfoApi =
        infoRes.data?.data ?? infoRes.data ?? {};
      setApiInfo(infoRaw);

      const historyPayload = historyRes.data?.data ?? historyRes.data ?? [];
      const historyList: LoyaltyHistoryApi[] = Array.isArray(historyPayload)
        ? historyPayload
        : [];
      setHistory(historyList.map(mapHistoryFromApi));
    } catch (err: unknown) {
      console.error("Failed to load loyalty data:", err);
      setApiInfo(null);
      setHistory([]);

      // axiosClient trả lỗi đã chuẩn hóa dạng { status, message, data }
      const apiMsg = (err as { message?: unknown })?.message;
      toast.error(
        typeof apiMsg === "string" && apiMsg
          ? apiMsg
          : "Could not load loyalty details",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLoyalty();
  }, [fetchLoyalty]);

  // Có dữ liệu API thì dùng (profile làm dự phòng cho field thiếu),
  // chưa có thì hiển thị tạm theo profile
  const loyaltyInfo = useMemo<LoyaltyInfo>(
    () => (apiInfo ? mapInfoFromApi(apiInfo, user) : mapInfoFromProfile(user)),
    [apiInfo, user],
  );

  return {
    user,
    loyaltyInfo,
    history,
    loading,
    refresh: fetchLoyalty,
  };
}
