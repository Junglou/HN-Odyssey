import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import axiosClient from "../../api/axiosClient";
import type { UserOrder } from "../../types/user";
import type {
  CustomerOrderListItem,
  CustomerOrdersListQuery,
  CustomerOrdersListResponse,
} from "../../types/order";
import {
  type CustomerOrderListApiItem,
  mapCustomerOrderFromApi,
} from "../../utils/mapCustomerOrder";
import tokenStorage from "../../utils/tokenStorage";
import {
  clampPaginationPage,
  useResponsiveProfilePagination,
} from "./useResponsiveOrderPageLimit";

/** Backend treats COMPLETED filter as COMPLETED + DELIVERED in DB */
const COMPLETED_ORDER_STATUSES = new Set(["COMPLETED", "DELIVERED"]);

const isCompletedOrder = (status?: string | null): boolean =>
  COMPLETED_ORDER_STATUSES.has(String(status ?? "").toUpperCase());

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string })?.message ||
      error.message ||
      fallback
    );
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

type HistoryOrdersLoadResult = {
  orders: UserOrder[];
  totalFiltered: number;
  safePage: number;
};

async function loadHistoryOrders(
  page: number,
  limit: number,
): Promise<HistoryOrdersLoadResult> {
  if (!tokenStorage.getToken()) {
    return { orders: [], totalFiltered: 0, safePage: page };
  }

  const params: CustomerOrdersListQuery = {
    page,
    limit,
    status: "COMPLETED",
  };

  const res = await axiosClient.get<CustomerOrdersListResponse>(
    "/users/customers/orders",
    { params },
  );

  const payload = res.data ?? {
    data: [],
    meta: { total: 0, page: 1, limit, total_pages: 0 },
  };

  const list = payload.data ?? [];
  const completedOnly = (list as CustomerOrderListItem[]).filter((o) =>
    isCompletedOrder(o.status),
  );

  const mapped: UserOrder[] = completedOnly.map((order) =>
    mapCustomerOrderFromApi(order as CustomerOrderListApiItem),
  );

  const totalFromApi = Number(payload.meta?.total ?? 0);
  const totalCount = totalFromApi > 0 ? totalFromApi : completedOnly.length;
  const maxPage = totalCount > 0 ? Math.ceil(totalCount / limit) : 1;

  return {
    orders: mapped,
    totalFiltered: totalCount,
    safePage: clampPaginationPage(page, maxPage),
  };
}

/**
 * Loads completed/delivered orders for purchase history via
 * `GET /users/customers/orders?status=COMPLETED`.
 */
export function useHistoryManagement() {
  const [orders, setOrders] = useState<UserOrder[]>([]);

  const { page, limit, setPage, resetPage, pagination } =
    useResponsiveProfilePagination();
  const [totalFiltered, setTotalFiltered] = useState<number>(0);

  const applyLoadResult = useCallback(
    (result: HistoryOrdersLoadResult) => {
      setOrders(result.orders);
      setTotalFiltered(result.totalFiltered);
      if (result.safePage !== page) setPage(result.safePage);
    },
    [page, setPage],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await loadHistoryOrders(page, limit);
        if (cancelled) return;
        applyLoadResult(result);
      } catch (err: unknown) {
        if (cancelled) return;
        console.error("Không thể tải lịch sử đơn hàng:", err);
        toast.error(getErrorMessage(err, "Không thể tải lịch sử đơn hàng."));
        setOrders([]);
        setTotalFiltered(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, limit, applyLoadResult]);

  const fetchOrders = useCallback(async () => {
    try {
      const result = await loadHistoryOrders(page, limit);
      applyLoadResult(result);
    } catch (err: unknown) {
      console.error("Không thể tải lịch sử đơn hàng:", err);
      toast.error(getErrorMessage(err, "Không thể tải lịch sử đơn hàng."));
      setOrders([]);
      setTotalFiltered(0);
    }
  }, [page, limit, applyLoadResult]);

  const totalPages = totalFiltered > 0 ? Math.ceil(totalFiltered / limit) : 0;
  const startIndex = (page - 1) * limit;

  const actions = {
    changePage: (nextPage: number) => setPage(nextPage),
    changeLimit: () => resetPage(),
    refresh: () => fetchOrders(),
  };

  return {
    orders,
    pagination: {
      ...pagination,
      totalPages,
      totalFiltered,
      startIndex,
    },
    actions,
  };
}
