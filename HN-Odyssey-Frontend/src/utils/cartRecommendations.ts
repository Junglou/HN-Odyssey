import axiosClient from "../api/axiosClient";

const GUEST_SESSION_KEY = "guestSessionId";

/** Same session id as checkout — used by cart and cart-recommendation APIs. */
export const getGuestSessionId = (): string => {
  let sessionId = localStorage.getItem(GUEST_SESSION_KEY);
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem(GUEST_SESSION_KEY, sessionId);
  }
  return sessionId;
};

export interface CartRecommendationApiItem {
  _id?: string;
  id?: string;
  name?: string;
  description?: string;
  short_description?: string;
  price?: number;
  sale_price?: number;
  thumbnail?: string;
  images?: string[];
  gallery?: { url?: string }[];
  variants?: Array<{ sale_price?: number; price?: number }>;
}

interface ApiCartItem {
  productId: string;
}

interface CartSnapshot {
  sessionId: string;
  subtotal: number;
  excludeIds: string;
}

const extractRecommendationList = (
  payload: unknown,
): CartRecommendationApiItem[] => {
  if (Array.isArray(payload)) {
    return payload as CartRecommendationApiItem[];
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data: unknown }).data;
    if (Array.isArray(data)) {
      return data as CartRecommendationApiItem[];
    }
  }
  return [];
};

const loadCartSnapshot = async (): Promise<CartSnapshot> => {
  const sessionId = getGuestSessionId();

  try {
    const res = await axiosClient.get(`/cart?guestSessionId=${sessionId}`);
    const items = (res.data?.items ?? []) as ApiCartItem[];
    const subtotal = Number(res.data?.summary?.subtotal ?? 0);
    const excludeIds = items.map((item) => item.productId).join(",");

    return { sessionId, subtotal, excludeIds };
  } catch {
    return { sessionId, subtotal: 0, excludeIds: "" };
  }
};

/**
 * Cart-context recommendations — same endpoint as checkout success sidebar.
 * `GET /recommendations/cart?session_id&current_cart_total&exclude_ids`
 */
export async function fetchCartRecommendationProducts(
  limit = 6,
): Promise<CartRecommendationApiItem[]> {
  const { sessionId, subtotal, excludeIds } = await loadCartSnapshot();

  const res = await axiosClient.get(
    `/recommendations/cart?session_id=${sessionId}&current_cart_total=${subtotal}&exclude_ids=${excludeIds}`,
  );

  return extractRecommendationList(res.data).slice(0, limit);
}
