import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import axiosClient from "../../api/axiosClient";
import type { Product } from "../../types/product";
import tokenStorage from "../../utils/tokenStorage";
import {
  fetchCartRecommendationProducts,
  getGuestSessionId,
  type CartRecommendationApiItem,
} from "../../utils/cartRecommendations";

export const PROFILE_RECOMMEND_COUNT = 3;

export type RecommendProduct = Product;

// Khai báo Interface chuẩn để dọn sạch lỗi "Unexpected any"
interface AuthUser {
  _id?: string | { $oid: string };
  id?: string;
  [key: string]: unknown;
}

const getLoggedInUserId = (): string | undefined => {
  const user = tokenStorage.getUser<AuthUser>();
  if (!user) return undefined;

  if (user._id && typeof user._id === "object" && "$oid" in user._id) {
    return String(user._id.$oid);
  }

  const id = user._id || user.id;
  return id ? String(id) : undefined;
};

const mapRecommendProductFromApi = (
  item: CartRecommendationApiItem,
): RecommendProduct => {
  const galleryUrls =
    item.gallery
      ?.map((media) => media.url)
      .filter((url): url is string => !!url) ?? [];
  const images = [
    ...(item.thumbnail ? [item.thumbnail] : []),
    ...(item.images ?? []),
    ...galleryUrls,
  ];
  const variantPrice =
    item.variants?.[0]?.sale_price ?? item.variants?.[0]?.price;
  const salePrice = Number(item.sale_price ?? variantPrice ?? 0);
  const basePrice = Number(item.price ?? item.variants?.[0]?.price ?? 0);
  const displayPrice = salePrice > 0 ? salePrice : basePrice;

  return {
    id: String(item._id ?? item.id ?? ""),
    name: item.name ?? "",
    description: (item.short_description || item.description || "").trim(),
    price: displayPrice,
    image: images[0] ?? "",
  };
};

const extractProductList = (payload: unknown): CartRecommendationApiItem[] => {
  if (Array.isArray(payload)) {
    return payload as CartRecommendationApiItem[];
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const root = payload as Record<string, unknown>;

  if (Array.isArray(root.products)) {
    return root.products as CartRecommendationApiItem[];
  }
  if (Array.isArray(root.data)) {
    return root.data as CartRecommendationApiItem[];
  }

  const nested = root.data;
  if (nested && typeof nested === "object") {
    const dataObj = nested as Record<string, unknown>;
    if (Array.isArray(dataObj.products)) {
      return dataObj.products as CartRecommendationApiItem[];
    }
    if (Array.isArray(dataObj.data)) {
      return dataObj.data as CartRecommendationApiItem[];
    }
  }

  return [];
};

const fetchPersonalizedProducts = async (
  sessionId: string,
  userId?: string,
): Promise<CartRecommendationApiItem[]> => {
  const params: Record<string, string> = { session_id: sessionId };
  if (userId) {
    params.user_id = userId;
  }

  const res = await axiosClient.get("/recommendations/personalized", {
    params,
  });

  return extractProductList(res.data);
};

const fetchDiscoverProducts = async (
  userId?: string,
): Promise<CartRecommendationApiItem[]> => {
  const params: Record<string, string> = {};
  if (userId) {
    params.user_id = userId;
  }

  const res = await axiosClient.get("/recommendations/discover", { params });

  return extractProductList(res.data);
};

async function loadRecommendProducts(
  limit: number,
): Promise<RecommendProduct[]> {
  const userId = getLoggedInUserId();
  const sessionId = getGuestSessionId();
  let rawList: CartRecommendationApiItem[] = [];

  try {
    rawList = await fetchDiscoverProducts(userId);
  } catch (discoverErr) {
    console.warn("Discover recommendations unavailable:", discoverErr);
  }

  if (rawList.length === 0) {
    try {
      rawList = await fetchPersonalizedProducts(sessionId, userId);
    } catch (personalizedErr) {
      console.warn(
        "Personalized recommendations unavailable:",
        personalizedErr,
      );
    }
  }

  if (rawList.length === 0) {
    try {
      rawList = await fetchCartRecommendationProducts(limit);
    } catch (cartErr) {
      console.warn("Cart recommendations unavailable:", cartErr);
    }
  }

  return rawList
    .map(mapRecommendProductFromApi)
    .filter((item) => item.id && item.name)
    .slice(0, limit);
}

export function useRecommendProduct(limit: number = PROFILE_RECOMMEND_COUNT) {
  const [products, setProducts] = useState<RecommendProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const mapped = await loadRecommendProducts(limit);
        if (!cancelled) setProducts(mapped);
      } catch (err: unknown) {
        if (cancelled) return;
        console.error("Failed to load recommended products:", err);
        setProducts([]);

        let msg = "Could not load recommended products";
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
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [limit]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const mapped = await loadRecommendProducts(limit);
      setProducts(mapped);
    } catch (err: unknown) {
      console.error("Failed to load recommended products:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  return {
    products,
    loading,
    refresh,
  };
}
