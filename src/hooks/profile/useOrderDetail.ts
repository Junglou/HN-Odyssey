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

/**
 * Loads a single customer order via
 * `GET /users/customers/orders/:orderId` (scoped by JWT + CUSTOMER role on backend).
 */
export function useOrderDetail(orderId: string) {
  const [order, setOrder] = useState<UserOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = orderId.trim();

    if (!id) {
      setOrder(null);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const detail = await loadCustomerOrderDetail(id);
        if (cancelled) return;
        setOrder(detail);
      } catch (error: unknown) {
        if (cancelled) return;
        console.error("Không thể tải chi tiết đơn hàng:", error);
        toast.error(getErrorMessage(error, "Không thể tải chi tiết đơn hàng"));
        setOrder(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const refresh = useCallback(async () => {
    const id = orderId.trim();
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
