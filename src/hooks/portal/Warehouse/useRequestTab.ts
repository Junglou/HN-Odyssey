import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../api/axiosClient";

// 1. ĐỊNH NGHĨA INTERFACE
export interface RequestItem {
  sku: string;
  productName: string;
  quantity: number;
}

export interface RequestData {
  id: string;
  requestCode: string;
  type: "import" | "export";
  source: "Sales" | "Purchasing";
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  items: RequestItem[];
  note?: string;
}

interface PaginationMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

interface RequestApiResponse {
  success: boolean;
  message: string;
  data: RequestData[];
  meta?: PaginationMeta;
  metadata?: PaginationMeta;
}

export function useRequestTab() {
  const [data, setData] = useState<RequestData[]>([]);
  const [filters, setFilters] = useState({
    search: "",
    type: "all" as "all" | "import" | "export",
    status: "pending" as "all" | "pending" | "accepted" | "rejected",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [triggerRefresh, setTriggerRefresh] = useState<number>(0);

  // 3. LOGIC FETCH DATA (ĐÃ THÊM CHỐNG CACHE)
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const res = await axiosClient.get<RequestApiResponse>(
          "/inventory/stock/requests",
          {
            params: {
              page: pagination.page,
              limit: pagination.limit,
              search: filters.search || undefined,
              type: filters.type !== "all" ? filters.type : undefined,
              status: filters.status !== "all" ? filters.status : undefined,
              _t: Date.now(), // [FIX QUAN TRỌNG]: Chống Cache của trình duyệt
            },
          },
        );

        if (!isMounted) return;

        const responseData = (res.data
          ? res.data
          : res) as unknown as RequestApiResponse;
        const items = responseData.data || [];
        const meta = responseData.meta || responseData.metadata;

        if (Array.isArray(items)) {
          setData(items);
        }

        if (meta) {
          setPagination((prev) => ({
            ...prev,
            total: meta.totalItems || 0,
            totalPages: meta.totalPages || 1,
          }));
        }
      } catch (error) {
        console.error("Lỗi khi tải danh sách yêu cầu kho:", error);
        toast.error("Lỗi khi tải danh sách yêu cầu kho!"); // Đã đổi sang toast
        if (isMounted) setData([]);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      void fetchData();
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(delayDebounceFn);
    };
  }, [
    pagination.page,
    pagination.limit,
    filters.search,
    filters.type,
    filters.status,
    triggerRefresh,
  ]);

  const changeFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ search: "", type: "all", status: "pending" });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const changePage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const changeLimit = (limit: number) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }));
  };

  const refreshData = () => {
    setTriggerRefresh((prev) => prev + 1);
  };

  // 5. KẾT NỐI API DUYỆT (BẮT LỖI ẨN TỪ BE)
  const acceptRequest = async (id: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await axiosClient.post(
        "/inventory/stock/accept-orders",
        {
          order_ids: [id],
        },
      );

      // Bóc tách payload tùy thuộc vào việc axiosClient có xài interceptor không
      const responseData = res.data || res;
      const payload = responseData.data || responseData;

      // [FIX QUAN TRỌNG]: Kiểm tra biến failed do BE trả về (lỗi thiếu tồn kho)
      if (payload && payload.failed > 0) {
        const errors = payload.errors || [];
        const errMsg =
          errors.length > 0
            ? errors[0].reason
            : "Lỗi: Không đủ tồn kho chờ xử lý (stock_on_hold)!";
        toast.error(`Không thể duyệt phiếu: ${errMsg}`); // Đã đổi sang toast
        return; // Ép dừng, không tải lại danh sách
      }

      toast.success("Duyệt yêu cầu thành công!"); // Đã đổi sang toast
      refreshData();
    } catch (error: unknown) {
      console.error("Lỗi khi duyệt yêu cầu:", error);
      // Ép kiểu an toàn để lấy message lỗi thực tế từ BE
      const err = error as {
        message?: string;
        response?: { data?: { message?: string } };
      };
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Có lỗi xảy ra khi duyệt yêu cầu!";

      toast.error(errorMessage); // Đã đổi sang toast
    }
  };

  // 6. KẾT NỐI API TỪ CHỐI
  const rejectRequest = async (id: string, reason: string) => {
    try {
      await axiosClient.post("/inventory/stock/report-issue", {
        order_id: id,
        reason: reason,
      });
      toast.success("Đã từ chối và tạm giữ yêu cầu!"); // Đã đổi sang toast
      refreshData();
    } catch (error: unknown) {
      console.error("Lỗi khi từ chối yêu cầu:", error);
      // Ép kiểu an toàn
      const err = error as {
        message?: string;
        response?: { data?: { message?: string } };
      };
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Có lỗi xảy ra khi thực hiện từ chối yêu cầu!";

      toast.error(errorMessage); // Đã đổi sang toast
    }
  };

  return {
    data,
    filters,
    pagination,
    actions: {
      changeFilter,
      clearFilters,
      changePage,
      changeLimit,
      refreshData,
      acceptRequest,
      rejectRequest,
    },
  };
}
