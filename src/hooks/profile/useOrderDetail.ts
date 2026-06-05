import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import axiosClient from "../../api/axiosClient";
import type {
  CustomerOrderDetail,
  CustomerOrderDetailResponse,
} from "../../types/order";
import type { UserOrderDetail } from "../../types/user";
import { mapCustomerOrderDetailFromApi } from "../../utils/mapCustomerOrder";
import tokenStorage from "../../utils/tokenStorage";
import type { RecommendProduct } from "./useRecommendProduct";

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string })?.message ||
      error.message ||
      fallback
    );
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
};

const extractOrderDetailFromResponse = (
  body: unknown,
): CustomerOrderDetail | null => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const root = body as Record<string, unknown>;

  if (root.data && typeof root.data === "object") {
    return root.data as CustomerOrderDetail;
  }

  if ("_id" in root && "order_code" in root) {
    return body as CustomerOrderDetail;
  }

  return null;
};

async function loadCustomerOrderDetail(
  orderId: string,
): Promise<UserOrderDetail | null> {
  const id = orderId.trim();
  if (!id || !tokenStorage.getToken()) {
    return null;
  }

  const res = await axiosClient.get<CustomerOrderDetailResponse>(
    `/users/customers/orders/${encodeURIComponent(id)}`,
  );

  const raw = extractOrderDetailFromResponse(res.data);
  if (!raw) {
    return null;
  }

  return mapCustomerOrderDetailFromApi(raw);
}

export function useOrderDetail(orderId: string) {
  const [order, setOrder] = useState<UserOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchOrderDetail = async () => {
      const id = orderId?.trim() || "";

      if (!id) {
        setOrder((prev) => (prev === null ? prev : null));
        setLoading((prev) => (prev === false ? prev : false));
        return;
      }

      setLoading(true);
      try {
        const detail = await loadCustomerOrderDetail(id);
        if (!cancelled) setOrder(detail);
      } catch (error: unknown) {
        if (!cancelled) {
          console.error("Không thể tải chi tiết đơn hàng:", error);
          toast.error(
            getErrorMessage(error, "Không thể tải chi tiết đơn hàng"),
          );
          setOrder(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchOrderDetail();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const refresh = useCallback(async () => {
    const id = orderId?.trim() || "";
    if (!id) {
      setOrder(null);
      return;
    }

    setLoading(true);
    try {
      const detail = await loadCustomerOrderDetail(id);
      setOrder(detail);
    } catch (error: unknown) {
      console.error("Không thể tải chi tiết đơn hàng:", error);
      toast.error(getErrorMessage(error, "Không thể tải chi tiết đơn hàng"));
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  return {
    order,
    loading,
    refresh,
  };
}

// ============================================
// CÁC HOOK GỌI AI MODEL TRONG CHI TIẾT ĐƠN HÀNG
// ============================================

export function useOrderFBT(productId?: string) {
  const [fbtProducts, setFbtProducts] = useState<RecommendProduct[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchFbtData = async () => {
      if (!productId) {
        setFbtProducts((prev) => (prev.length === 0 ? prev : []));
        return;
      }

      try {
        const res = await axiosClient.get<unknown[]>(
          `/recommendations/fbt?product_id=${productId}&limit=5`,
        );

        if (cancelled) return;

        if (Array.isArray(res.data)) {
          const mapped: RecommendProduct[] = res.data
            .map((item) => {
              const obj = item as Record<string, unknown>;
              const p = (obj.product as Record<string, unknown>) || {};
              return {
                id: String(p._id || p.id || ""),
                name: String(p.name || ""),
                description: String(p.description || p.short_description || ""),
                price: Number(p.price || 0),
                image: String(p.thumbnail || p.image || ""),
                slug: String(p.slug || ""),
              };
            })
            .filter((p) => p.id && p.name);

          setFbtProducts(mapped);
        }
      } catch (err) {
        console.warn("Lỗi load FBT:", err);
        if (!cancelled) {
          setFbtProducts((prev) => (prev.length === 0 ? prev : []));
        }
      }
    };

    fetchFbtData();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  return { fbtProducts };
}

export function useLookingSimilar(productId?: string) {
  const [similarProducts, setSimilarProducts] = useState<RecommendProduct[]>(
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const fetchSimilarData = async () => {
      if (!productId) {
        setSimilarProducts((prev) => (prev.length === 0 ? prev : []));
        return;
      }

      try {
        const res = await axiosClient.get<Record<string, unknown>>(
          `/recommendations/personalized/similar?product_id=${productId}`,
        );

        if (cancelled) return;
        const data = res.data;

        if (data && Array.isArray(data.products)) {
          const mapped: RecommendProduct[] = data.products
            .map((pObj) => {
              const p = pObj as Record<string, unknown>;
              return {
                id: String(p._id || p.id || ""),
                name: String(p.name || ""),
                description: String(p.description || p.short_description || ""),
                price: Number(p.price || 0),
                image: String(p.thumbnail || p.image || ""),
                slug: String(p.slug || ""),
              };
            })
            .filter((p) => p.id && p.name);

          setSimilarProducts(mapped);
        }
      } catch (err) {
        console.warn("Lỗi load Similar:", err);
        if (!cancelled) {
          setSimilarProducts((prev) => (prev.length === 0 ? prev : []));
        }
      }
    };

    fetchSimilarData();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  return { similarProducts };
}
