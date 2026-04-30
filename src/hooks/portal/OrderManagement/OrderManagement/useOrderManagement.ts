import { useState, useMemo } from "react";

// types
export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "Packaging"
  | "Shipping"
  | "Delivered"
  | "Cancelled"
  | "Refunded";
export type PaymentStatus = "Unpaid" | "Paid" | "Refunded";

export interface OrderItem {
  id: string;
  sku: string;
  productName: string;
  description?: string;
  quantity: number;
  price: number;
  image: string;
}

export interface OrderTimeline {
  status: string;
  date: string;
  description: string;
  isCompleted: boolean;
}

export interface OrderRow {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  email: string;
  shippingAddress: string;
  orderDate: string;
  shipDate?: string;
  subtotal: number;
  shipFee: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdBy: "Customer" | "Sales Staff";
  items: OrderItem[];
  timeline: OrderTimeline[];
  note?: string;
}

// mock data
const MOCK_ORDERS: OrderRow[] = [
  {
    id: "1",
    orderCode: "ORD-123-001",
    customerName: "Nguyen Van A",
    customerPhone: "0901234567",
    email: "nguyenvana@gmail.com",
    shippingAddress: "123 Le Loi, D1, HCM",
    orderDate: "2024-05-26T10:30:00Z",
    shipDate: "2024-05-28T00:00:00Z",
    subtotal: 45.99,
    shipFee: 5.0,
    totalAmount: 50.99,
    paymentStatus: "Unpaid",
    orderStatus: "Pending",
    createdBy: "Customer",
    items: [
      {
        id: "i1",
        sku: "SKU01",
        productName: "Ration 1",
        description: "Instant energy supply with no cooking required.",
        quantity: 1,
        price: 45.99,
        image: "https://via.placeholder.com/120x80",
      },
    ],
    timeline: [
      {
        status: "Order Placed",
        date: "2024-05-26T10:30:00Z",
        description: "Customer placed order",
        isCompleted: true,
      },
    ],
  },
  {
    id: "2",
    orderCode: "ORD-123-002",
    customerName: "Tran Thi B",
    customerPhone: "0987654321",
    email: "tranthib@gmail.com",
    shippingAddress: "456 Nguyen Van Linh, D7, HCM",
    orderDate: "2024-05-25T14:15:00Z",
    subtotal: 90.99,
    shipFee: 10.0,
    totalAmount: 100.99,
    paymentStatus: "Paid",
    orderStatus: "Confirmed",
    createdBy: "Sales Staff",
    items: [
      {
        id: "i2",
        sku: "SKU02",
        productName: "Mechanical Keyboard",
        quantity: 2,
        price: 45.495,
        image: "https://via.placeholder.com/40",
      },
    ],
    timeline: [
      {
        status: "Order Placed",
        date: "2024-05-25T14:00:00Z",
        description: "Sales staff created order",
        isCompleted: true,
      },
      {
        status: "Confirmed",
        date: "2024-05-25T14:15:00Z",
        description: "Admin confirmed",
        isCompleted: true,
      },
    ],
  },
  {
    id: "3",
    orderCode: "ORD-123-003",
    customerName: "Le Van C",
    customerPhone: "0933444555",
    email: "levanc@hotmail.com",
    shippingAddress: "789 Tran Hung Dao, D5, HCM",
    orderDate: "2024-05-24T09:00:00Z",
    subtotal: 65.99,
    shipFee: 10.0,
    totalAmount: 75.99,
    paymentStatus: "Paid",
    orderStatus: "Shipping",
    createdBy: "Customer",
    items: [],
    timeline: [],
  },
  {
    id: "4",
    orderCode: "ORD-123-004",
    customerName: "Pham Thi D",
    customerPhone: "0911222333",
    email: "phamthid@company.com",
    shippingAddress: "111 Nguyen Trai, D1, HCM",
    orderDate: "2024-05-23T16:45:00Z",
    subtotal: 114.99,
    shipFee: 0.0,
    totalAmount: 114.99,
    paymentStatus: "Paid",
    orderStatus: "Delivered",
    createdBy: "Sales Staff",
    items: [],
    timeline: [],
  },
];

// hook
export function useOrderManagement() {
  // states
  const [data, setData] = useState<OrderRow[]>(MOCK_ORDERS);

  const [filters, setFilters] = useState({
    search: "",
    status: "all" as OrderStatus | "all",
    fromDate: "",
    toDate: "",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
  });

  const [detailDrawer, setDetailDrawer] = useState<{
    isOpen: boolean;
    orderId: string | null;
  }>({
    isOpen: false,
    orderId: null,
  });

  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    orderId: string | null;
    currentStatus: OrderStatus | null;
  }>({
    isOpen: false,
    orderId: null,
    currentStatus: null,
  });

  // derived data
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchSearch =
        item.orderCode.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.customerName.toLowerCase().includes(filters.search.toLowerCase());
      const matchStatus =
        filters.status === "all" || item.orderStatus === filters.status;

      let matchDate = true;
      if (filters.fromDate || filters.toDate) {
        const orderDateObj = new Date(item.orderDate);

        if (filters.fromDate) {
          const fromDateObj = new Date(filters.fromDate);
          fromDateObj.setHours(0, 0, 0, 0);
          if (orderDateObj < fromDateObj) matchDate = false;
        }

        if (filters.toDate) {
          const toDateObj = new Date(filters.toDate);
          toDateObj.setHours(23, 59, 59, 999);
          if (orderDateObj > toDateObj) matchDate = false;
        }
      }

      return matchSearch && matchStatus && matchDate;
    });
  }, [data, filters]);

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pagination.limit) || 1;

  const currentData = useMemo(() => {
    const start = (pagination.page - 1) * pagination.limit;
    return filteredData.slice(start, start + pagination.limit);
  }, [filteredData, pagination]);

  // actions
  const actions = {
    changeFilter: (key: keyof typeof filters, val: string) => {
      setFilters((prev) => ({ ...prev, [key]: val }));
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

    // drawer logic
    openDetail: (orderId: string) => {
      setDetailDrawer({ isOpen: true, orderId });
    },
    closeDetail: () => {
      setDetailDrawer({ isOpen: false, orderId: null });
    },

    // status update modal logic
    openStatusModal: (orderId: string, currentStatus: OrderStatus) => {
      setStatusModal({ isOpen: true, orderId, currentStatus });
    },
    closeStatusModal: () => {
      setStatusModal({ isOpen: false, orderId: null, currentStatus: null });
    },
    confirmUpdateStatus: (
      orderId: string,
      newStatus: OrderStatus,
      reason: string,
    ) => {
      setData((prev) =>
        prev.map((order) => {
          if (order.id === orderId) {
            const newTimelineItem: OrderTimeline = {
              status: newStatus,
              date: new Date().toISOString(),
              description: reason,
              isCompleted: true,
            };
            return {
              ...order,
              orderStatus: newStatus,
              timeline: [...order.timeline, newTimelineItem],
            };
          }
          return order;
        }),
      );
      setStatusModal({ isOpen: false, orderId: null, currentStatus: null });
    },
    advanceOrderStatus: (orderId: string, nextStatus: OrderStatus) => {
      setData((prev) =>
        prev.map((order) => {
          if (order.id === orderId) {
            const newTimelineItem: OrderTimeline = {
              status: nextStatus,
              date: new Date().toISOString(),
              description: "system auto updated",
              isCompleted: true,
            };
            return {
              ...order,
              orderStatus: nextStatus,
              timeline: [...order.timeline, newTimelineItem],
            };
          }
          return order;
        }),
      );
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
      setData(MOCK_ORDERS);
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
    selectedOrder: data.find((o) => o.id === detailDrawer.orderId) || null,
    statusModal,
    actions,
  };
}
