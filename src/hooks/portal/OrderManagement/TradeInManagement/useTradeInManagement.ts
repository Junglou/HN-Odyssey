import { useState, useMemo } from "react";

// types
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
  image: string;
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
}

// mock data
const MOCK_TRADE_INS: TradeInRow[] = [
  {
    id: "1",
    tradeInCode: "TIR-123-001",
    customerName: "Nguyen Van A",
    customerPhone: "0903111245",
    email: "nva@example.com",
    device: {
      productName: "Grey Jacket",
      storage: "L",
      condition: "New",
      image: "https://via.placeholder.com/120x80",
    },
    expectedValue: 50.99,
    status: "Pending",
    createdAt: "2024-05-26T10:30:00Z",
    timeline: [
      {
        status: "Request Submitted",
        date: "2024-05-26T10:30:00Z",
        description: "Customer submitted trade-in request.",
        isCompleted: true,
      },
    ],
  },
  {
    id: "2",
    tradeInCode: "TIR-123-002",
    customerName: "Tran Thi B",
    customerPhone: "0903121245",
    email: "ttb@example.com",
    device: {
      productName: "Grey Jacket",
      storage: "M",
      condition: "Used",
      image: "https://via.placeholder.com/120x80",
    },
    expectedValue: 100.99,
    status: "Approved",
    createdAt: "2024-05-25T14:15:00Z",
    timeline: [
      {
        status: "Approved",
        date: "2024-05-25T16:00:00Z",
        description: "Staff approved preliminary condition.",
        isCompleted: true,
      },
    ],
  },
  {
    id: "3",
    tradeInCode: "TIR-123-003",
    customerName: "Le Van C",
    customerPhone: "0903114125",
    email: "lvc@example.com",
    device: {
      productName: "Grey Jacket",
      storage: "XL",
      condition: "Good",
      image: "https://via.placeholder.com/120x80",
    },
    expectedValue: 75.99,
    status: "Received",
    createdAt: "2024-05-24T14:15:00Z",
    timeline: [],
  },
  {
    id: "4",
    tradeInCode: "TIR-123-004",
    customerName: "Pham Thi D",
    customerPhone: "0951211245",
    email: "ptd@example.com",
    device: {
      productName: "Grey Jacket",
      storage: "S",
      condition: "Fair",
      image: "https://via.placeholder.com/120x80",
    },
    expectedValue: 114.99,
    status: "Completed",
    createdAt: "2024-05-23T14:15:00Z",
    timeline: [],
  },
];

export function useTradeInManagement() {
  // states
  const [data, setData] = useState<TradeInRow[]>(MOCK_TRADE_INS);

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    fromDate: "",
    toDate: "",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
  });

  // drawer & modal states
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

  // logic: filter
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const term = filters.search.toLowerCase();
      const matchSearch =
        !term ||
        item.tradeInCode.toLowerCase().includes(term) ||
        item.customerName.toLowerCase().includes(term) ||
        item.customerPhone.includes(term) ||
        item.email.toLowerCase().includes(term);

      const matchStatus =
        filters.status === "all" || item.status === filters.status;

      let matchDate = true;
      if (filters.fromDate || filters.toDate) {
        const itemDateObj = new Date(item.createdAt);

        if (filters.fromDate) {
          const fromDateObj = new Date(filters.fromDate);
          fromDateObj.setHours(0, 0, 0, 0);
          if (itemDateObj < fromDateObj) matchDate = false;
        }

        if (filters.toDate) {
          const toDateObj = new Date(filters.toDate);
          toDateObj.setHours(23, 59, 59, 999);
          if (itemDateObj > toDateObj) matchDate = false;
        }
      }

      return matchSearch && matchStatus && matchDate;
    });
  }, [data, filters]);

  // logic: pagination
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pagination.limit) || 1;

  const currentData = useMemo(() => {
    const start = (pagination.page - 1) * pagination.limit;
    return filteredData.slice(start, start + pagination.limit);
  }, [filteredData, pagination]);

  const selectedTradeIn = useMemo(() => {
    return data.find((item) => item.id === detailDrawer.tradeInId) || null;
  }, [data, detailDrawer.tradeInId]);

  // actions
  const actions = {
    // filter & pagination
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

    // drawer & modals
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

    // business actions
    approveTradeIn: (id: string) => {
      setData((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            return {
              ...t,
              status: "Approved",
              timeline: [
                ...t.timeline,
                {
                  status: "Approved",
                  date: new Date().toISOString(),
                  description: "Request approved by staff.",
                  isCompleted: true,
                },
              ],
            };
          }
          return t;
        }),
      );
    },
    createOrder: (id: string) => {
      setData((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            return {
              ...t,
              status: "Shipping",
              timeline: [
                ...t.timeline,
                {
                  status: "Order Created",
                  date: new Date().toISOString(),
                  description:
                    "Pickup order has been created. Waiting for logistics.",
                  isCompleted: true,
                },
              ],
            };
          }
          return t;
        }),
      );
    },
    // Mock API kho bắn mã vạch
    simulateScanReceive: (id: string) => {
      setData((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            return {
              ...t,
              status: "Received",
              timeline: [
                ...t.timeline,
                {
                  status: "Received",
                  date: new Date().toISOString(),
                  description: "Warehouse scanned and received the item.",
                  isCompleted: true,
                },
              ],
            };
          }
          return t;
        }),
      );
    },
    confirmReject: (id: string, reason: string) => {
      setData((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            return {
              ...t,
              status: "Rejected",
              note: reason,
              timeline: [
                ...t.timeline,
                {
                  status: "Rejected",
                  date: new Date().toISOString(),
                  description: `Rejected. Reason: ${reason}`,
                  isCompleted: true,
                },
              ],
            };
          }
          return t;
        }),
      );
      actions.closeRejectModal();
    },
    confirmFinalize: (
      id: string,
      finalValue: number,
      method: string,
      note: string,
    ) => {
      setData((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            return {
              ...t,
              status: "Completed",
              finalValue,
              payoutMethod: method,
              timeline: [
                ...t.timeline,
                {
                  status: "Completed",
                  date: new Date().toISOString(),
                  description: `Finalized: $${finalValue} via ${method}. Note: ${note}`,
                  isCompleted: true,
                },
              ],
            };
          }
          return t;
        }),
      );
      actions.closeFinalizeModal();
    },

    // global actions
    exportExcel: () => {
      alert("Tính năng tải file Excel (Mock)");
    },
    printInvoice: (selectedIds?: string[]) => {
      alert(
        `Tính năng in Hóa đơn (Mock)\nCác đơn đã chọn: ${selectedIds?.join(", ")}`,
      );
    },
    printDeliverySlip: (selectedIds?: string[]) => {
      alert(
        `Tính năng in Phiếu giao hàng (Mock)\nCác đơn đã chọn: ${selectedIds?.join(", ")}`,
      );
    },
    refreshData: () => {
      setData(MOCK_TRADE_INS);
      setFilters({ search: "", status: "all", fromDate: "", toDate: "" });
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
  };

  return {
    data: currentData,
    filters,
    pagination: {
      ...pagination,
      total: totalItems,
      totalPages,
      startIndex:
        totalItems === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1,
      endIndex: Math.min(pagination.page * pagination.limit, totalItems),
    },
    detailDrawer,
    selectedTradeIn,
    rejectModal,
    finalizeModal,
    actions,
  };
}
