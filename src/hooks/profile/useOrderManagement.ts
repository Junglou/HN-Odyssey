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
    page,
    limit,
  };

  if (search.trim()) {
    params.keyword = search.trim();
  }

  if (statusFilter !== "All") {
    params.status = mapStatusFilterToApi(statusFilter);
  }

  const res = await axiosClient.get<CustomerOrdersListResponse>(
    "/users/customers/orders",
    { params },
  );

  const payload = res.data ?? {
    data: [],
    meta: { total: 0, page: 1, limit, total_pages: 0 },
  };
  const mapped = (payload.data ?? []).map(mapCustomerOrderFromApi);
  const totalCount = payload.meta?.total ?? 0;
  const maxPage = totalCount > 0 ? Math.ceil(totalCount / limit) : 1;

  return {
    orders: mapped,
    totalFiltered: totalCount,
    safePage: clampPaginationPage(page, maxPage),
  };
}

/**
 * Loads the logged-in customer's orders via
 * `GET /users/customers/orders` (scoped by JWT + CUSTOMER role on backend).
 */
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
