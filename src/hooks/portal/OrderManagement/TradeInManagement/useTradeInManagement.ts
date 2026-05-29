import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "react-toastify";
import { io } from "socket.io-client";
import axiosClient from "../../../../api/axiosClient";

export type TradeInStatus =
  | "Pending"
  | "Approved"
  | "Shipping"
  | "Received"
  | "Completed"
  | "Rejected"
  | "Cancelled";

export interface TradeInDevice {
  productName: string;
  storage: string;
  condition: string;
  images: string[];
}

export interface TradeInTimeline {
  status: string;
  date: string;
  description: string;
  isCompleted: boolean;
}

export interface TradeInRow {
  id: string;
  tradeInCode: string;
  customerName: string;
  customerPhone: string;
  email: string;
  device: TradeInDevice;
  expectedValue: number;
  finalValue?: number;
  payoutMethod?: string;
  status: TradeInStatus;
  createdAt: string;
  timeline: TradeInTimeline[];
  note?: string;
  evaluationMethod: string;
}

interface PopulatedCustomer {
  _id: string;
  fullName?: string;
  email: string;
  phone: string;
}

interface PopulatedCategory {
  _id: string;
  name: string;
}

interface TimelineItemBE {
  status: string;
  timestamp: string;
  note?: string;
  actor_id?: string;
}

interface TradeInRequestBE {
  _id: string;
  request_code: string;
  customer_id?: PopulatedCustomer;
  full_name: string;
  email: string;
  phone_number: string;
  category_id?: PopulatedCategory;
  product_name?: string;
  condition_description: string;
  media_urls: string[];
  estimated_value: number;
  final_value: number;
  status: TradeInStatus;
  payout_method: string;
  timeline: TimelineItemBE[];
  device_storage?: string;
  evaluation_method?: string;
  createdAt: string;
  updatedAt: string;
}

// SỬA LỖI 1: Đổi metadata thành meta để đồng bộ với BaseResponse của Backend
interface FetchResponse {
  success: boolean;
  message: string;
  data: TradeInRequestBE[];
  meta?: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
  };
}

const formatStatusToFE = (beStatus: string): TradeInStatus => {
  if (!beStatus) return "Pending";
  const formatted =
    beStatus.charAt(0).toUpperCase() + beStatus.slice(1).toLowerCase();
  return formatted as TradeInStatus;
};

export function useTradeInManagement() {
  const [data, setData] = useState<TradeInRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMutating, setIsMutating] = useState<boolean>(false);

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    fromDate: "",
    toDate: "",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
  });

  const [detailDrawer, setDetailDrawer] = useState<{
    isOpen: boolean;
    tradeInId: string | null;
  }>({ isOpen: false, tradeInId: null });

  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    tradeInId: string | null;
  }>({ isOpen: false, tradeInId: null });

  const [finalizeModal, setFinalizeModal] = useState<{
    isOpen: boolean;
    tradeInId: string | null;
  }>({ isOpen: false, tradeInId: null });

  const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
  const serverBaseUrl = rawApiUrl.replace(/\/api\/?$/, "");

  const fetchTradeIns = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (filters.status !== "all") params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;

      const response = await axiosClient.get<FetchResponse>(
        "/trade-in/admin/requests",
        { params },
      );

      // 1. Ép kiểu qua unknown rồi thành Record để vượt qua ESLint Strict Mode mà không dùng 'any'
      const resUnknown = response as unknown as Record<string, unknown>;

      // 2. Ép kiểu tường minh (Explicit Type) để TypeScript hiểu rõ cấu trúc của payload
      const payload: FetchResponse =
        "success" in resUnknown
          ? (response as unknown as FetchResponse)
          : response.data;

      // 3. Khẳng định items là một mảng TradeInRequestBE để hàm .map() không báo lỗi 2339
      const items: TradeInRequestBE[] = Array.isArray(payload?.data)
        ? payload.data
        : [];

      // 4. TS đã hiểu payload là FetchResponse nên truy xuất .meta sẽ hợp lệ
      const meta = payload?.meta || {
        totalItems: 0,
        totalPages: 1,
        currentPage: 1,
      };
      const mappedData: TradeInRow[] = items.map((item: TradeInRequestBE) => ({
        id: item._id,
        tradeInCode: item.request_code,
        customerName: item.customer_id?.fullName || item.full_name,
        customerPhone: item.customer_id?.phone || item.phone_number,
        email: item.customer_id?.email || item.email,
        device: {
          productName: item.product_name || item.category_id?.name || "",
          storage: item.device_storage || "",
          condition: item.condition_description || "",
          images: (item.media_urls || []).map((url) =>
            url.startsWith("http") ? url : `${serverBaseUrl}${url}`,
          ),
        },
        expectedValue: item.estimated_value || 0,
        finalValue: item.final_value || 0,
        payoutMethod: item.payout_method,
        status: formatStatusToFE(item.status),
        createdAt: item.createdAt,
        evaluationMethod: item.evaluation_method || "SHIPPING",
        timeline: (item.timeline || []).map((tl) => ({
          status: formatStatusToFE(tl.status),
          date: tl.timestamp,
          description: tl.note || "",
          isCompleted: true,
        })),
        note:
          item.timeline?.length > 0
            ? item.timeline[item.timeline.length - 1].note
            : undefined,
      }));

      setData(mappedData);
      setPagination((prev) => ({ ...prev, totalItems: meta.totalItems }));
    } catch (error: unknown) {
      console.error("Fetch trade-ins error:", error);
      toast.error("Không thể tải danh sách Trade-in.");
    } finally {
      setIsLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    filters.status,
    filters.search,
    filters.fromDate,
    filters.toDate,
  ]);

  //... Phần code còn lại giữ nguyên 100% không ảnh hưởng ...
  // Socket.io effect
  useEffect(() => {
    fetchTradeIns();
  }, [fetchTradeIns]);

  useEffect(() => {
    const rawApiUrl =
      import.meta.env.VITE_API_URL || "http://localhost:8080/api";
    const socketBaseUrl = rawApiUrl.replace(/\/api\/?$/, "");

    const token = localStorage.getItem("access_token") || "";

    const socket = io(`${socketBaseUrl}/notifications`, {
      transports: ["websocket"],
      autoConnect: true,
      auth: {
        token: token,
      },
    });

    socket.on(
      "trade_in_status_updated",
      (payload: { requestCode: string; status: string }) => {
        toast.info(`Hệ thống vừa cập nhật tự động đơn ${payload.requestCode}`);
        fetchTradeIns();
      },
    );

    socket.on("connect_error", (err: Error) => {
      console.error("Lỗi kết nối Socket.io:", err.message);
    });

    return () => {
      socket.off("trade_in_status_updated");
      socket.off("connect_error");
      socket.disconnect();
    };
  }, [fetchTradeIns]);

  const totalPages = Math.ceil(pagination.totalItems / pagination.limit) || 1;
  const selectedTradeIn = useMemo(() => {
    return data.find((item) => item.id === detailDrawer.tradeInId) || null;
  }, [data, detailDrawer.tradeInId]);

  const mapPayoutMethodToEnum = (feMethod: string): string => {
    switch (feMethod) {
      case "Reward Points":
        return "Reward Points";
      case "Service Promotion":
        return "Service Promotion";
      case "Store Credit / Voucher":
      default:
        return "Store Credit / Voucher";
    }
  };

  const actions = {
    changeFilter: (key: keyof typeof filters, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    clearFilters: () => {
      setFilters({ search: "", status: "all", fromDate: "", toDate: "" });
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    changePage: (page: number) => {
      setPagination((prev) => ({ ...prev, page }));
    },
    changeLimit: (limit: number) => {
      setPagination((prev) => ({ ...prev, limit, page: 1 }));
    },

    openDetail: (id: string) =>
      setDetailDrawer({ isOpen: true, tradeInId: id }),
    closeDetail: () => setDetailDrawer({ isOpen: false, tradeInId: null }),

    openRejectModal: (id: string) =>
      setRejectModal({ isOpen: true, tradeInId: id }),
    closeRejectModal: () => setRejectModal({ isOpen: false, tradeInId: null }),

    openFinalizeModal: (id: string) =>
      setFinalizeModal({ isOpen: true, tradeInId: id }),
    closeFinalizeModal: () =>
      setFinalizeModal({ isOpen: false, tradeInId: null }),

    approveTradeIn: async (id: string) => {
      if (isMutating) return;
      setIsMutating(true);
      try {
        await axiosClient.patch(`/trade-in/admin/request/${id}/approve`);
        toast.success("Đã phê duyệt yêu cầu Trade-in.");
        fetchTradeIns();
      } catch (error: unknown) {
        console.error("Approve trade-in error:", error);
        toast.error("Lỗi khi phê duyệt yêu cầu.");
      } finally {
        setIsMutating(false);
      }
    },

    createOrder: async (id: string) => {
      if (isMutating) return;
      setIsMutating(true);
      try {
        await axiosClient.patch(`/trade-in/admin/request/${id}/create-order`);
        toast.success("Đã tạo vận đơn thu hồi sản phẩm.");
        fetchTradeIns();
      } catch (error: unknown) {
        console.error("Create order error:", error);
        toast.error("Lỗi khi tạo vận đơn.");
      } finally {
        setIsMutating(false);
      }
    },

    receiveItem: async (id: string) => {
      if (isMutating) return;
      setIsMutating(true);
      try {
        await axiosClient.patch(`/trade-in/admin/request/${id}/receive`);
        toast.success("Xác nhận đã nhận thiết bị tại quầy thành công.");
        fetchTradeIns();
      } catch (error: unknown) {
        console.error("Receive item error:", error);
        toast.error("Lỗi khi xác nhận nhận hàng.");
      } finally {
        setIsMutating(false);
      }
    },

    markShippingAsReceived: async (id: string) => {
      if (isMutating) return;
      setIsMutating(true);
      try {
        await axiosClient.patch(
          `/trade-in/admin/request/${id}/sandbox-receive`,
        );
        toast.success("Đã chuyển trạng thái Đã nhận (Môi trường Sandbox).");
        fetchTradeIns();
      } catch (error: unknown) {
        console.error("Sandbox receive error:", error);
        toast.error("Lỗi khi cập nhật trạng thái Sandbox.");
      } finally {
        setIsMutating(false);
      }
    },

    confirmReject: async (id: string, reason: string) => {
      if (isMutating) return;
      setIsMutating(true);
      try {
        await axiosClient.patch(`/trade-in/admin/request/${id}/reject`, {
          reason,
        });
        toast.success("Đã từ chối yêu cầu Trade-in.");
        actions.closeRejectModal();
        fetchTradeIns();
      } catch (error: unknown) {
        console.error("Reject trade-in error:", error);
        toast.error("Từ chối thất bại.");
      } finally {
        setIsMutating(false);
      }
    },

    confirmFinalize: async (
      id: string,
      finalValue: number,
      method: string,
      note: string,
    ) => {
      if (isMutating) return;
      setIsMutating(true);
      try {
        const payoutEnum = mapPayoutMethodToEnum(method);
        await axiosClient.patch(`/trade-in/admin/request/${id}/finalize`, {
          finalValue: finalValue,
          method: payoutEnum,
          note: note,
        });
        toast.success("Hoàn tất quy trình thẩm định giá thành công.");
        actions.closeFinalizeModal();
        fetchTradeIns();
      } catch (error: unknown) {
        console.error("Finalize trade-in error:", error);
        toast.error("Lỗi khi lưu kết quả thẩm định.");
      } finally {
        setIsMutating(false);
      }
    },

    exportExcel: async () => {
      try {
        toast.info("Đang xuất file Excel...");

        // CẢI TIẾN 1: Đẩy toàn bộ dữ liệu bộ lọc thời gian hiện tại từ UI lên Server
        const params: Record<string, string> = {};
        if (filters.status !== "all") params.status = filters.status;
        if (filters.search) params.search = filters.search;
        if (filters.fromDate) params.fromDate = filters.fromDate;
        if (filters.toDate) params.toDate = filters.toDate;

        const response = await axiosClient.get("/trade-in/admin/export/excel", {
          params,
          responseType: "blob",
        });

        // CẢI TIẾN 2: Trích xuất Blob an toàn tương thích với mọi cấu hình Axios Interceptor
        const resUnknown = response as unknown as Record<string, unknown>;
        const blobPayload =
          "data" in resUnknown && resUnknown.data !== undefined
            ? resUnknown.data
            : response;

        const url = window.URL.createObjectURL(
          new Blob([blobPayload as BlobPart]),
        );
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `TradeIn_Report_${Date.now()}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success("Xuất file Excel thành công!");
      } catch (error: unknown) {
        console.error("Export Excel error:", error);
        toast.error("Lỗi khi kết xuất dữ liệu Excel.");
      }
    },

    printInvoice: async (selectedIds?: string[]) => {
      if (!selectedIds || selectedIds.length === 0) {
        toast.warning("Vui lòng chọn ít nhất một đơn để in Hóa đơn.");
        return;
      }
      try {
        toast.info("Đang khởi tạo file PDF Hóa đơn...");
        const response = await axiosClient.post(
          "/trade-in/admin/print-bulk",
          { ids: selectedIds },
          { params: { type: "INVOICE" }, responseType: "blob" },
        );

        const url = window.URL.createObjectURL(
          new Blob([response.data as BlobPart], { type: "application/pdf" }),
        );
        window.open(url, "_blank");
      } catch (error: unknown) {
        console.error("Print Invoice error:", error);
        toast.error("Lỗi khi xuất Hóa đơn PDF.");
      }
    },

    printDeliverySlip: async (selectedIds?: string[]) => {
      if (!selectedIds || selectedIds.length === 0) {
        toast.warning("Vui lòng chọn ít nhất một đơn để in Phiếu giao.");
        return;
      }
      try {
        toast.info("Đang khởi tạo file PDF Phiếu giao...");
        const response = await axiosClient.post(
          "/trade-in/admin/print-bulk",
          { ids: selectedIds },
          { params: { type: "PACKING_SLIP" }, responseType: "blob" },
        );

        const url = window.URL.createObjectURL(
          new Blob([response.data as BlobPart], { type: "application/pdf" }),
        );
        window.open(url, "_blank");
      } catch (error: unknown) {
        console.error("Print Delivery Slip error:", error);
        toast.error("Lỗi khi xuất Phiếu giao hàng PDF.");
      }
    },

    refreshData: () => {
      fetchTradeIns();
    },
  };

  return {
    data,
    filters,
    pagination: {
      ...pagination,
      total: pagination.totalItems,
      totalPages,
      startIndex:
        pagination.totalItems === 0
          ? 0
          : (pagination.page - 1) * pagination.limit + 1,
      endIndex: Math.min(
        pagination.page * pagination.limit,
        pagination.totalItems,
      ),
    },
    detailDrawer,
    selectedTradeIn,
    rejectModal,
    finalizeModal,
    actions,
    isLoading,
    isMutating,
  };
}
