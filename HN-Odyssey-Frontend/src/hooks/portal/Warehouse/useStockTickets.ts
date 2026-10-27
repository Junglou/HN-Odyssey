import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../api/axiosClient";
import tokenStorage from "../../../utils/tokenStorage";
import { Action, Resource } from "../../../types/permissions";
import { getApiErrorMessage } from "../../../utils/apiError";

// 1. FE TYPES
export type TicketType = "import" | "export";
export type TicketStatus = "PROCESSING" | "COMPLETED" | "CANCELLED";

export interface TicketItem {
  sku: string;
  productName: string;
  quantity: number;
  reason?: string;
}

export interface StockTicketRow {
  id: string;
  ticketCode: string;
  type: TicketType;
  warehouse: string;
  createdDate: string;
  createdBy: string;
  totalQuantity: number;
  status: TicketStatus;
  note: string;
  items: TicketItem[];
  supplier?: string;
  exportReason?: string;
  cancelReason?: string;
}

// 2. BE RESPONSE INTERFACES
interface BackendActor {
  email?: string;
}

interface BackendProduct {
  name?: string;
}

interface BackendTransactionItem {
  sku: string;
  product_id?: BackendProduct;
  quantity: number;
  note?: string;
}

interface BackendTransaction {
  _id: string;
  transaction_code: string;
  action_type: string;
  warehouse?: string;
  created_at: string;
  actor_id?: BackendActor;
  total_quantity: number;
  status: string;
  note: string;
  items: BackendTransactionItem[];
  supplier?: string;
  export_reason?: string;
  cancel_reason?: string;
}

interface ErrorResponse {
  message?: string;
}

// [THÊM MỚI]: Giao diện User cho việc kiểm tra quyền
interface UserPayload {
  roles?: string[];
  permissions?: { resource: string; actions: string[] }[];
}

// 3. MAIN HOOK
export function useStockTickets() {
  // states
  const [data, setData] = useState<StockTicketRow[]>([]);
  const [filters, setFilters] = useState({ search: "", type: "all" });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // [CẬP NHẬT]: Thêm initialSku vào state để chứa mã được truyền sang
  const [createDrawer, setCreateDrawer] = useState<{
    isOpen: boolean;
    defaultType: TicketType;
    initialSku?: string;
  }>({ isOpen: false, defaultType: "import" });

  const [loading, setLoading] = useState(true);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // --- LOGIC PHÂN QUYỀN ---
  const user = tokenStorage.getUser() as UserPayload | null;
  const hasPermission = (resourceCode: Resource, actionCode: Action) => {
    if (!user || !user.permissions) return false;
    if (user.roles && user.roles.includes("SUPER_ADMIN")) return true;
    const perm = user.permissions.find((p) => p.resource === resourceCode);
    if (!perm) return false;
    return (
      perm.actions.includes(actionCode) || perm.actions.includes(Action.MANAGE)
    );
  };

  const canCreateTicket = hasPermission(
    Resource.INVENTORY_TRANSFERS,
    Action.CREATE,
  );
  const canUpdateTicket = hasPermission(
    Resource.INVENTORY_TRANSFERS,
    Action.UPDATE,
  );
  const canCancelTicket = hasPermission(
    Resource.INVENTORY_TRANSFERS,
    Action.CANCEL,
  );
  const canExportFile = hasPermission(
    Resource.INVENTORY_TRANSFERS,
    Action.READ,
  );

  // fetch data
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.search) queryParams.append("search", filters.search);
      if (filters.type !== "all") {
        queryParams.append("action_type", filters.type.toUpperCase());
      }

      const response = await axiosClient.get(
        `/inventory/transactions/history/all?${queryParams.toString()}&_t=${Date.now()}`,
      );

      const resultData: BackendTransaction[] = response.data.data;
      const meta = response.data.meta || response.data.pagination;

      const mappedData: StockTicketRow[] = resultData.map(
        (item: BackendTransaction) => ({
          id: item._id,
          ticketCode: item.transaction_code,
          type: item.action_type.toLowerCase() as TicketType,
          warehouse: item.warehouse || "N/A",
          createdDate: item.created_at,
          createdBy: item.actor_id?.email || "N/A",
          totalQuantity: item.total_quantity,
          status: item.status as TicketStatus,
          note: item.note,
          items: (item.items || []).map((i: BackendTransactionItem) => ({
            sku: i.sku || "N/A",
            productName: i.product_id?.name || "Sản phẩm không xác định",
            quantity: i.quantity || 0,
            reason: i.note || "",
          })),
          supplier: item.supplier,
          exportReason: item.export_reason,
          cancelReason: item.cancel_reason,
        }),
      );

      setData(mappedData);
      setPagination((prev) => ({
        ...prev,
        total: meta?.totalItems || 0,
        totalPages: meta?.totalPages || 1,
      }));
    } catch (error: unknown) {
      console.error("Lỗi tải danh sách phiếu:", error);
      toast.error(
        getApiErrorMessage(
          error,
          "Không thể tải danh sách phiếu kho từ hệ thống.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters.search, filters.type]);

  useEffect(() => {
    const delay = setTimeout(() => fetchTickets(), 500);
    return () => clearTimeout(delay);
  }, [fetchTickets, refetchTrigger]);

  // actions
  const actions = {
    changeFilter: (key: keyof typeof filters, val: string) => {
      setFilters((prev) => ({ ...prev, [key]: val }));
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    clearFilter: () => {
      setFilters({ search: "", type: "all" });
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    changePage: (page: number) => {
      setPagination((prev) => ({ ...prev, page }));
    },
    changeLimit: (limit: number) => {
      setPagination((prev) => ({ ...prev, limit, page: 1 }));
    },
    refreshData: () => {
      setRefetchTrigger((prev) => prev + 1);
    },
    // [CẬP NHẬT]: Nhận thêm initialSku
    openCreateDrawer: (type: TicketType, initialSku?: string) => {
      setCreateDrawer({ isOpen: true, defaultType: type, initialSku });
    },
    closeCreateDrawer: () => {
      setCreateDrawer((prev) => ({
        ...prev,
        isOpen: false,
        initialSku: undefined,
      }));
    },
    submitTicket: async (
      payload: Omit<
        StockTicketRow,
        "id" | "ticketCode" | "createdDate" | "createdBy"
      >,
    ) => {
      // [CHẶN QUYỀN]
      if (!canCreateTicket) {
        toast.error("Bạn không có quyền tạo phiếu kho!");
        return;
      }

      try {
        let endpoint = "";
        let requestBody = {};

        if (payload.type === "import") {
          endpoint = "/inventory/transactions/import";
          requestBody = {
            warehouse: payload.warehouse,
            supplier: payload.supplier,
            note: payload.note,
            items: payload.items.map((i) => ({
              sku: i.sku,
              product_name: i.productName,
              quantity: i.quantity,
              reason: i.reason,
            })),
          };
        } else {
          endpoint = "/inventory/transactions/export";
          requestBody = {
            warehouse: payload.warehouse,
            exportReason: payload.exportReason,
            note: payload.note,
            items: payload.items.map((i) => ({
              sku: i.sku,
              product_name: i.productName,
              quantity: i.quantity,
              reason: i.reason,
            })),
          };
        }

        await axiosClient.post(endpoint, requestBody);
        toast.success("Tạo phiếu nháp thành công!");
        setRefetchTrigger((prev) => prev + 1);
        setPagination((prev) => ({ ...prev, page: 1 }));
      } catch (error: unknown) {
        console.error(error);
        const err = error as ErrorResponse;
        toast.error(err.message || "Có lỗi xảy ra khi tạo phiếu!");
      }
    },
    completeTicket: async (ticketId: string) => {
      // [CHẶN QUYỀN]
      if (!canUpdateTicket) {
        toast.error("Bạn không có quyền hoàn tất phiếu kho!");
        return;
      }

      try {
        await axiosClient.patch(`/inventory/transactions/${ticketId}/complete`);
        toast.success("Đã hoàn tất phiếu và cập nhật tồn kho!");
        setRefetchTrigger((prev) => prev + 1);
      } catch (error: unknown) {
        console.error(error);
        const err = error as ErrorResponse;
        toast.error(err.message || "Lỗi hoàn thành phiếu!");
      }
    },
    cancelTicket: async (ticketId: string, reason: string) => {
      // [CHẶN QUYỀN]
      if (!canCancelTicket) {
        toast.error("Bạn không có quyền hủy phiếu kho!");
        return;
      }

      try {
        await axiosClient.patch(`/inventory/transactions/${ticketId}/cancel`, {
          reason,
        });
        toast.success("Đã hủy phiếu thành công!");
        setRefetchTrigger((prev) => prev + 1);
      } catch (error: unknown) {
        console.error(error);
        const err = error as ErrorResponse;
        toast.error(err.message || "Lỗi hủy phiếu!");
      }
    },
    exportPdf: async (
      ticketId: string,
      type: TicketType,
      ticketCode: string,
    ) => {
      // [CHẶN QUYỀN]
      if (!canExportFile) {
        toast.error("Bạn không có quyền in/xuất báo cáo phiếu kho!");
        return;
      }

      try {
        toast.info("Đang xử lý xuất file PDF, vui lòng đợi...");
        const endpoint =
          type === "import"
            ? `/inventory/transactions/import/history/pdf/${ticketId}`
            : `/inventory/transactions/export/history/pdf/${ticketId}`;

        const response = await axiosClient.get(endpoint, {
          responseType: "blob",
        });
        const blob = new Blob([response.data], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        const fileName =
          type === "import"
            ? `PhieuNhap_${ticketCode}.pdf`
            : `PhieuXuat_${ticketCode}.pdf`;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();

        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Xuất file PDF thành công!");
      } catch (error: unknown) {
        console.error(error);
        toast.error(getApiErrorMessage(error, "Lỗi khi tải PDF từ hệ thống!"));
      }
    },
  };

  return {
    data,
    loading,
    filters,
    pagination,
    createDrawer,
    actions,
    permissions: {
      canCreateTicket,
      canUpdateTicket,
      canCancelTicket,
      canExportFile,
    },
  };
}
