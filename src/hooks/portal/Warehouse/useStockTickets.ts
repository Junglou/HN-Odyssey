import { useState, useEffect } from "react";

// types
export type TicketType = "import" | "export";
export type TicketStatus = "processing" | "completed" | "cancelled";

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

// mock data

// hook
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
  const [createDrawer, setCreateDrawer] = useState<{
    isOpen: boolean;
    defaultType: TicketType;
  }>({ isOpen: false, defaultType: "import" });

  const [loading, setLoading] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // derived data
  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
          search: filters.search,
          type: filters.type !== "all" ? filters.type : "",
        }).toString();

        const response = await fetch(
          `http://localhost:8080/api/tickets?${queryParams}`,
        );
        if (!response.ok) throw new Error("Fetch failed");

        const result = await response.json();
        setData(result.data || []);
        setPagination((prev) => ({
          ...prev,
          total: result.total || 0,
          totalPages: result.totalPages || 1,
        }));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    const delay = setTimeout(() => fetchTickets(), 500);
    return () => clearTimeout(delay);
  }, [pagination.page, pagination.limit, filters, refetchTrigger]);

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
    openCreateDrawer: (type: TicketType) => {
      setCreateDrawer({ isOpen: true, defaultType: type });
    },
    closeCreateDrawer: () => {
      setCreateDrawer((prev) => ({ ...prev, isOpen: false }));
    },
    submitTicket: async (
      payload: Omit<
        StockTicketRow,
        "id" | "ticketCode" | "createdDate" | "createdBy"
      >,
    ) => {
      try {
        const response = await fetch("http://localhost:8080/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Lỗi tạo phiếu");
        alert("Tạo phiếu thành công!");
        setRefetchTrigger((prev) => prev + 1);
        setPagination((prev) => ({ ...prev, page: 1 }));
      } catch (error) {
        console.error(error);
        alert("Có lỗi xảy ra khi tạo phiếu!");
      }
    },
    completeTicket: async (ticketId: string) => {
      try {
        const response = await fetch(
          `http://localhost:8080/api/tickets/${ticketId}/complete`,
          {
            method: "PUT",
          },
        );
        if (!response.ok) throw new Error("Lỗi cập nhật");
        alert("Đã hoàn thành phiếu!");
        setRefetchTrigger((prev) => prev + 1);
      } catch (error) {
        console.error(error);
        alert("Lỗi hoàn thành phiếu!");
      }
    },
    cancelTicket: async (ticketId: string, reason: string) => {
      try {
        const response = await fetch(
          `http://localhost:8080/api/tickets/${ticketId}/cancel`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          },
        );
        if (!response.ok) throw new Error("Lỗi hủy phiếu");
        alert("Đã hủy phiếu!");
        setRefetchTrigger((prev) => prev + 1);
      } catch (error) {
        console.error(error);
        alert("Lỗi hủy phiếu!");
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
  };
}
