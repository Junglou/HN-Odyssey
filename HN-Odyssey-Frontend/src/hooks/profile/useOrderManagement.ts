import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import axiosClient from "../../api/axiosClient";
import type { UserOrder } from "../../types/user";
import type {
  CustomerOrdersListQuery,
  CustomerOrdersListResponse,
  CustomerOrderListStatusFilter,
} from "../../types/order";
import { mapCustomerOrderFromApi } from "../../utils/mapCustomerOrder";
import tokenStorage from "../../utils/tokenStorage";
import {
  clampPaginationPage,
  useResponsiveProfilePagination,
} from "./useResponsiveOrderPageLimit";

export type OrderStatusFE =
  | "Pending"
  | "Processing"
  | "Delivering"
  | "Delivered"
  | "Canceled";

interface TradeInHistoryItem {
  _id: string;
  request_code: string;
  product_name?: string;
  status: string;
  final_value?: number;
  estimated_value?: number;
  media_urls?: string[];
  createdAt: string;
}

const mapStatusFilterToApi = (
  status: OrderStatusFE,
): CustomerOrderListStatusFilter => {
  const map: Record<OrderStatusFE, CustomerOrderListStatusFilter> = {
    Pending: "PENDING",
    Processing: "PROCESSING",
    Delivering: "DELIVERING",
    Delivered: "COMPLETED",
    Canceled: "CANCELED",
  };
  return map[status];
};

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

const doesTradeInMatchFilter = (
  tradeInStatus: string,
  filter: OrderStatusFE | "All",
) => {
  if (filter === "All") return true;
  switch (filter) {
    case "Pending":
      return tradeInStatus === "Pending";
    case "Processing":
      return tradeInStatus === "Approved" || tradeInStatus === "Received";
    case "Delivering":
      return tradeInStatus === "Shipping";
    case "Delivered":
      return tradeInStatus === "Completed";
    case "Canceled":
      return tradeInStatus === "Rejected" || tradeInStatus === "Cancelled";
    default:
      return true;
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

type OrderManagementLoadResult = {
  orders: UserOrder[];
  totalFiltered: number;
  safePage: number;
};

async function loadCustomerOrders(
  page: number,
  limit: number,
  search: string,
  statusFilter: OrderStatusFE | "All",
): Promise<OrderManagementLoadResult> {
  if (!tokenStorage.getToken()) {
    return { orders: [], totalFiltered: 0, safePage: page };
  }

  const params: CustomerOrdersListQuery = {
    page: 1,
    limit: 1000,
  };

  if (search.trim()) {
    params.keyword = search.trim();
  }

  if (statusFilter !== "All") {
    params.status = mapStatusFilterToApi(statusFilter);
  }

  const [ordersRes, tradeInsRes] = await Promise.all([
    axiosClient
      .get<CustomerOrdersListResponse>("/users/customers/orders", { params })
      .catch(() => null),
    axiosClient
      .get<{ data: TradeInHistoryItem[] }>("/trade-in/history")
      .catch(() => null),
  ]);

  const payload = ordersRes?.data ?? {
    data: [],
    meta: { total: 0, page: 1, limit, total_pages: 0 },
  };

  // BỨC TƯỜNG LỬA: Lọc ngay từ dữ liệu thô (raw data) của API trước khi map
  // Đơn thô (CustomerOrderListItem) có trường order_code. Ta sẽ loại bỏ các đơn ảo bắt đầu bằng "TRD"
  const rawOrders = payload.data ?? [];
  const validRawOrders = rawOrders.filter(
    (raw) => raw.order_code && !raw.order_code.startsWith("TRD"),
  );

  let standardOrders = validRawOrders.map(mapCustomerOrderFromApi);

  let tradeIns = tradeInsRes?.data?.data || [];

  if (Array.isArray(tradeIns) && tradeIns.length > 0) {
    if (search.trim()) {
      const kw = search.trim().toLowerCase();
      tradeIns = tradeIns.filter(
        (t) =>
          (t.request_code && t.request_code.toLowerCase().includes(kw)) ||
          (t.product_name && t.product_name.toLowerCase().includes(kw)),
      );
    }

    if (statusFilter !== "All") {
      tradeIns = tradeIns.filter((t) =>
        doesTradeInMatchFilter(t.status, statusFilter),
      );
    }

    // Map dữ liệu Trade-in thật về form Đơn hàng thông thường
    const mappedTradeIns = tradeIns.map((t) => {
      return mapCustomerOrderFromApi({
        _id: t._id,
        order_code: `[Trade-In] ${t.request_code}`,
        createdAt: t.createdAt,
        total_amount: t.final_value || t.estimated_value || 0,
        status: mapTradeInToOrderStatus(t.status),
        summary: {
          image: t.media_urls?.[0] || "",
          name: t.product_name || "Thiết bị Trade-in",
          remaining_count: 0,
        },
      });
    });

    standardOrders = [...standardOrders, ...mappedTradeIns];
  }

  // Sort gộp (Mới nhất lên đầu)
  standardOrders.sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime(),
  );

  const totalFiltered = standardOrders.length;
  const maxPage = totalFiltered > 0 ? Math.ceil(totalFiltered / limit) : 1;
  const safePage = clampPaginationPage(page, maxPage);

  const startIndex = (safePage - 1) * limit;
  const paginatedOrders = standardOrders.slice(startIndex, startIndex + limit);

  return {
    orders: paginatedOrders,
    totalFiltered,
    safePage,
  };
}

export function useOrderManagement() {
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatusFE | "All">(
    "All",
  );

  const { page, limit, setPage, resetPage, pagination } =
    useResponsiveProfilePagination();
  const [totalFiltered, setTotalFiltered] = useState(0);

  const applyLoadResult = useCallback(
    (result: OrderManagementLoadResult) => {
      setOrders(result.orders);
      setTotalFiltered(result.totalFiltered);
      if (result.safePage !== page) setPage(result.safePage);
    },
    [page, setPage],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const result = await loadCustomerOrders(
          page,
          limit,
          search,
          statusFilter,
        );
        if (cancelled) return;
        applyLoadResult(result);
      } catch (error: unknown) {
        if (cancelled) return;
        console.error("Không thể tải lịch sử đơn hàng:", error);
        toast.error(getErrorMessage(error, "Không thể tải lịch sử đơn hàng"));
        setOrders([]);
        setTotalFiltered(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, limit, search, statusFilter, applyLoadResult]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadCustomerOrders(
        page,
        limit,
        search,
        statusFilter,
      );
      applyLoadResult(result);
    } catch (error: unknown) {
      console.error("Không thể tải lịch sử đơn hàng:", error);
      toast.error(getErrorMessage(error, "Không thể tải lịch sử đơn hàng"));
      setOrders([]);
      setTotalFiltered(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, applyLoadResult]);

  const totalPages = totalFiltered > 0 ? Math.ceil(totalFiltered / limit) : 0;
  const startIndex = (page - 1) * limit;

  const actions = {
    changeSearch: (val: string) => {
      setSearch(val);
      resetPage();
    },
    changeStatusFilter: (status: OrderStatusFE | "All") => {
      setStatusFilter(status);
      resetPage();
    },
    clearFilters: () => {
      setSearch("");
      setStatusFilter("All");
      resetPage();
    },
    changePage: (nextPage: number) => setPage(nextPage),
    changeLimit: () => resetPage(),
    refresh: () => fetchOrders(),
  };

  return {
    orders,
    loading,
    pagination: {
      ...pagination,
      totalPages,
      totalFiltered,
      startIndex,
    },
    search,
    statusFilter,
    actions,
  };
}
