import { useState, useMemo } from "react";

// types
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

// mock data
const MOCK_REQUESTS: RequestData[] = [
  {
    id: "REQ-001",
    requestCode: "ORD-20260421-01",
    type: "export",
    source: "Sales",
    status: "pending",
    createdAt: new Date().toISOString(),
    items: [
      { sku: "LAP-001", productName: "Laptop Dell XPS 15", quantity: 2 },
      { sku: "MOU-001", productName: "Logitech MX Master 3", quantity: 2 },
    ],
  },
  {
    id: "REQ-002",
    requestCode: "PO-20260420-01",
    type: "import",
    source: "Purchasing",
    status: "pending",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    items: [{ sku: "KEY-002", productName: "Keychron K8 Pro", quantity: 50 }],
  },
];

export function useRequestTab() {
  // states
  const [data, setData] = useState<RequestData[]>(MOCK_REQUESTS);
  const [filters, setFilters] = useState({
    search: "",
    type: "all" as "all" | "import" | "export",
    status: "pending" as "all" | "pending" | "accepted" | "rejected",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
  });

  // handlers
  const changeFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ search: "", type: "all", status: "pending" });
    setPagination({ page: 1, limit: 10 });
  };

  const changePage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const changeLimit = (limit: number) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }));
  };

  const refreshData = () => {
    setData(MOCK_REQUESTS);
    clearFilters();
  };

  const acceptRequest = async (id: string) => {
    try {
      // 1. Gọi API gửi yêu cầu lên Server
      const response = await fetch(
        `http://localhost:8080/api/requests/${id}/accept`,
        {
          method: "PUT",
        },
      );

      if (!response.ok) throw new Error("Lỗi khi duyệt yêu cầu!");

      // 2. Nếu Backend báo OK, ta load lại toàn bộ bảng để lấy dữ liệu chuẩn
      // await fetchRequestsData(); // (Đây là hàm gọi API GET danh sách bạn sẽ phải viết)

      alert("Duyệt yêu cầu thành công!");
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra, vui lòng thử lại!");
    }
  };

  const rejectRequest = (id: string, reason: string) => {
    setData((prev) =>
      prev.map((req) =>
        req.id === id ? { ...req, status: "rejected", note: reason } : req,
      ),
    );
  };

  // derived data
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchSearch =
        item.requestCode.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.id.toLowerCase().includes(filters.search.toLowerCase());
      const matchType = filters.type === "all" || item.type === filters.type;
      const matchStatus =
        filters.status === "all" || item.status === filters.status;
      return matchSearch && matchType && matchStatus;
    });
  }, [data, filters]);

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pagination.limit) || 1;

  const paginatedData = useMemo(() => {
    const start = (pagination.page - 1) * pagination.limit;
    return filteredData.slice(start, start + pagination.limit);
  }, [filteredData, pagination]);

  return {
    data: paginatedData,
    filters,
    pagination: {
      ...pagination,
      total: totalItems,
      totalPages,
    },
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
