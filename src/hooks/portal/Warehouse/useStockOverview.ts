import { useState, useEffect } from "react";

// types
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface StockVariant {
  sku: string;
  attributes: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
}

export interface StockRowData {
  id: string;
  productName: string;
  sku: string;
  image: string;
  category: string;
  location: string;
  totalQuantity: number;
  availableQuantity: number;
  status: StockStatus;
  variants?: StockVariant[];
}

// mock data

export function useStockOverview() {
  // state dữ liệu chính của bảng
  const [data, setData] = useState<StockRowData[]>([]);

  const [loading, setLoading] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // states filter & pagination
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    category: "all",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // state điều khiển modal adjust
  const [adjustModal, setAdjustModal] = useState<{
    isOpen: boolean;
    productId: string | null;
    variantSku: string | null;
  }>({
    isOpen: false,
    productId: null,
    variantSku: null,
  });

  // derived data (lọc từ state data hiện tại)
  useEffect(() => {
    const fetchOverview = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
          search: filters.search,
          status: filters.status !== "all" ? filters.status : "",
          category: filters.category !== "all" ? filters.category : "",
        }).toString();

        const response = await fetch(
          `http://localhost:8080/api/inventory?${queryParams}`,
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

    const delay = setTimeout(() => fetchOverview(), 500);
    return () => clearTimeout(delay);
  }, [pagination.page, pagination.limit, filters, refetchTrigger]);

  // actions
  const actions = {
    changeFilter: (key: keyof typeof filters, val: string) => {
      setFilters((prev) => ({ ...prev, [key]: val }));
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    clearFilter: () => {
      setFilters({ search: "", status: "all", category: "all" });
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
    openAdjustModal: (productId: string, variantSku?: string) => {
      setAdjustModal({
        isOpen: true,
        productId,
        variantSku: variantSku || null,
      });
    },
    closeAdjustModal: () => {
      setAdjustModal({ isOpen: false, productId: null, variantSku: null });
    },
    submitAdjustment: async (payload: {
      type: string;
      quantity: number;
      reason: string;
    }) => {
      try {
        const adjustment =
          payload.type === "add" ? payload.quantity : -payload.quantity;

        const response = await fetch(
          `http://localhost:8080/api/inventory/${adjustModal.productId}/adjust`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              variantSku: adjustModal.variantSku,
              adjustment: adjustment,
              reason: payload.reason,
            }),
          },
        );

        if (!response.ok) throw new Error("Lỗi cập nhật kho");

        alert("Điều chỉnh kho thành công!");
        setAdjustModal({ isOpen: false, productId: null, variantSku: null });
        setRefetchTrigger((prev) => prev + 1);
      } catch (error) {
        console.error(error);
        alert("Lỗi điều chỉnh kho!");
      }
    },
  };

  return {
    data,
    loading,
    filters,
    pagination,
    adjustModal,
    actions,
  };
}
