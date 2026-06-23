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

interface TradeInHistoryDetail {
  _id: string;
  request_code: string;
  product_name?: string;
  status: string;
  final_value?: number;
  estimated_value?: number;
  media_urls?: string[];
  createdAt: string;
  updatedAt?: string;
  category_id?: { _id: string };
  payout_method?: string;
  payout_details?: { voucher_code?: string };
  full_name?: string;
  phone_number?: string;
  shipping_address?: { street_address?: string; city?: string };
  rma_order_code?: string;
  timeline?: { status: string; timestamp: string; note?: string }[];
}

const mapTradeInToOrderStatus = (tradeInStatus: string): string => {
  switch (tradeInStatus) {
    case "Pending":
      return "PENDING";
    case "Approved":
      return "CONFIRMED";
    case "Shipping":
      return "SHIPPING";
    case "Received":
      return "PROCESSING";
    case "Completed":
      return "COMPLETED";
    case "Rejected":
    case "Cancelled":
      return "CANCELLED";
    default:
      return "PENDING";
  }
};

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

  try {
    const res = await axiosClient.get<CustomerOrderDetailResponse>(
      `/users/customers/orders/${encodeURIComponent(id)}`,
    );

    const raw = extractOrderDetailFromResponse(res.data);
    if (raw) {
      // BỨC TƯỜNG LỬA BẢO VỆ TRANG CHI TIẾT: Ném lỗi ép rẽ nhánh nếu dính Đơn Ảo
      if (
        raw.payment?.method === "TRADE-IN" ||
        raw.order_code.startsWith("TRD")
      ) {
        throw new Error("SHADOW_ORDER_DETECTED");
      }
      return mapCustomerOrderDetailFromApi(raw);
    }
  } catch (error: unknown) {
    // Nếu API Đơn hàng thông thường trả 404 hoặc bị tường lửa chặn thì tiếp tục kiểm tra Trade-in
    const axiosErr = error as {
      response?: { status?: number };
      message?: string;
    };
    if (
      axiosErr?.response?.status !== 404 &&
      axiosErr?.response?.status !== 400 &&
      axiosErr?.message !== "SHADOW_ORDER_DETECTED"
    ) {
      console.warn("Lỗi fetch đơn thông thường:", error);
    }
  }

  // Fallback: Tìm đơn ở nhánh Lịch sử Trade-in (Đã gỡ bỏ try/catch rỗng để fix lỗi Eslint no-useless-catch)
  const res = await axiosClient.get<{ data: TradeInHistoryDetail }>(
    `/trade-in/history/${encodeURIComponent(id)}`,
  );

  const tradeIn = res.data?.data || res.data;
  if (tradeIn && tradeIn.request_code) {
    const fakeDetail: CustomerOrderDetail = {
      _id: tradeIn._id,
      order_code: `[Trade-In] ${tradeIn.request_code}`,
      isGuest: false,
      items: [
        {
          // FIX LỖI ALGOLIA: Để chuỗi rỗng thay vì nhét category_id vào, các Hook AI sẽ tự động bỏ qua không gọi API nữa
          product_id: "",
          sku: "TRADE-IN",
          product_name: tradeIn.product_name || "Thiết bị Trade-in",
          price: tradeIn.final_value || tradeIn.estimated_value || 0,
          quantity: 1,
          image: tradeIn.media_urls?.[0] || "",
        },
      ],
      payment: {
        method: tradeIn.payout_method || "Thu cũ đổi mới",
        status: tradeIn.status === "Completed" ? "PAID" : "PENDING",
      },
      total_amount: tradeIn.final_value || tradeIn.estimated_value || 0,
      status: mapTradeInToOrderStatus(tradeIn.status),
      discount_amount: 0,
      voucher_code: tradeIn.payout_details?.voucher_code || "",
      shipping_info: {
        name: tradeIn.full_name || "",
        phone: tradeIn.phone_number || "",
        address: tradeIn.shipping_address
          ? `${tradeIn.shipping_address.street_address}, ${tradeIn.shipping_address.city}`
          : "Giao dịch tại cửa hàng",
        district_code: "",
        ward_code: "",
        city_code: "",
      },
      waybill_code: tradeIn.rma_order_code || "",
      actual_shipping_fee: 0,
      timeline: (tradeIn.timeline || []).map((tl) => ({
        status: mapTradeInToOrderStatus(tl.status),
        timestamp: tl.timestamp,
        actor: "Hệ thống",
        note: tl.note,
      })),
      print_count: 0,
      points_used: 0,
      createdAt: tradeIn.createdAt,
      updatedAt: tradeIn.updatedAt || tradeIn.createdAt,
    };
    return mapCustomerOrderDetailFromApi(fakeDetail);
  }

  return null;
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

// CÁC HOOK GỌI AI MODEL TRONG CHI TIẾT ĐƠN HÀNG (Giữ nguyên)

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
