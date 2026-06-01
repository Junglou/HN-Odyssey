import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import { useProfileManagement, type ProfileUser } from "./useProfileManagement";
import tokenStorage from "../../utils/tokenStorage";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const getAuthHeaders = () => {
  const token = tokenStorage.getToken();
  return {
    headers: { Authorization: token ? `Bearer ${token}` : undefined },
  };
};

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
  const [loyaltyInfo, setLoyaltyInfo] = useState<LoyaltyInfo>(() =>
    mapInfoFromProfile(user),
  );
  const [history, setHistory] = useState<LoyaltyHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLoyalty = useCallback(async () => {
    setLoading(true);
    const fallback = mapInfoFromProfile(user);

    try {
      const [infoRes, historyRes] = await Promise.all([
        axios.get(`${API_URL}/loyalty/my-info`, getAuthHeaders()),
        axios.get(`${API_URL}/loyalty/history`, {
          ...getAuthHeaders(),
          params: { page: 1, limit: 10 },
        }),
      ]);

      const infoRaw: LoyaltyMyInfoApi =
        infoRes.data?.data ?? infoRes.data ?? {};
      setLoyaltyInfo(mapInfoFromApi(infoRaw, user));

      const historyPayload = historyRes.data?.data ?? historyRes.data ?? [];
      const historyList: LoyaltyHistoryApi[] = Array.isArray(historyPayload)
        ? historyPayload
        : [];
      setHistory(historyList.map(mapHistoryFromApi));
    } catch (err: unknown) {
      console.error("Failed to load loyalty data:", err);
      setLoyaltyInfo(fallback);
      setHistory([]);

      let msg = "Could not load loyalty details";
      if (axios.isAxiosError(err)) {
        msg =
          (err.response?.data as { message?: string })?.message ||
          err.message ||
          msg;
      } else if (err instanceof Error && err.message) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoyaltyInfo(mapInfoFromProfile(user));
  }, [user]);

  useEffect(() => {
    void fetchLoyalty();
  }, [fetchLoyalty]);

  return {
    user,
    loyaltyInfo,
    history,
    loading,
    refresh: fetchLoyalty,
  };
}
