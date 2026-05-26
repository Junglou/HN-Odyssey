import { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "react-toastify"; // ĐÃ THÊM THƯ VIỆN THÔNG BÁO
import axiosClient from "../../../api/axiosClient";

export type StockStatusColor = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface StockVariant {
  sku: string;
  total_stock: number;
  available_stock: number;
  statusColor: StockStatusColor;
  min_stock?: number;
  max_stock?: number;
}

export interface StockRowData {
  _id: string;
  sku: string;
  name: string;
  thumbnail: string;
  category: string;
  location: string;
  total_quantity: number;
  available_quantity: number;
  status_color: StockStatusColor;
  has_variants: boolean;
  variants: StockVariant[];
  min_stock?: number;
  max_stock?: number;
}

export interface CategoryTree {
  _id: string;
  name: string;
  slug: string;
  children?: CategoryTree[];
}

export interface AdjustPayload {
  type: string;
  quantity: number;
  reason: string;
}

export interface ThresholdPayload {
  minStock: number;
  maxStock: number;
}

export function useStockOverview() {
  // --- STATES ---
  const [data, setData] = useState<StockRowData[]>([]);
  const [categories, setCategories] = useState<
    { value: string; label: string }[]
  >([{ value: "all", label: "All Categories" }]);
  const [loading, setLoading] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

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

  const [adjustModal, setAdjustModal] = useState<{
    isOpen: boolean;
    productId: string | null;
    variantSku: string | null;
    productName: string;
    currentStock: number;
    minStock?: number;
    maxStock?: number;
  }>({
    isOpen: false,
    productId: null,
    variantSku: null,
    productName: "",
    currentStock: 0,
  });

  // --- FETCH DATA ---
  const fetchCategories = useCallback(async () => {
    try {
      const response = await axiosClient.get<CategoryTree[]>(
        "/categories/tree-view",
      );
      const fetchedCats = response.data.map((cat) => ({
        value: cat.slug,
        label: cat.name,
      }));
      setCategories([
        { value: "all", label: "All Categories" },
        ...fetchedCats,
      ]);
    } catch (error) {
      console.error("Failed to fetch categories", error);
      toast.error("Lỗi khi tải danh mục sản phẩm"); // Đã thêm toast
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (filters.search) params.search = filters.search;
      if (filters.category !== "all") params.category = filters.category;
      if (filters.status !== "all") {
        params.status = filters.status; // Truyền trực tiếp 'IN_STOCK', 'LOW_STOCK', hoặc 'OUT_OF_STOCK'
      }

      const response = await axiosClient.get("/inventory/stock", { params });

      const resData = response.data.data;
      setData(resData.data || []);
      setPagination((prev) => ({
        ...prev,
        total: resData.total || 0,
        totalPages: Math.ceil((resData.total || 0) / prev.limit) || 1,
      }));
    } catch (error) {
      console.error("Fetch stock failed", error);
      toast.error("Lỗi khi tải danh sách tồn kho"); // Đã thêm toast
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  // Khởi chạy khi component mount hoặc dependencies thay đổi
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const delay = setTimeout(() => fetchOverview(), 400);
    return () => clearTimeout(delay);
  }, [fetchOverview, refetchTrigger]);

  // --- WEBSOCKET REAL-TIME ---
  useEffect(() => {
    const socketUrl =
      import.meta.env.VITE_API_URL?.replace("/api", "") ||
      "http://localhost:8080";

    const socket: Socket = io(`${socketUrl}/inventory`);

    socket.on(
      "stock_updated",
      (payload: {
        product_id: string;
        sku: string;
        new_stock: number;
        timestamp: string;
      }) => {
        // 1. Cập nhật nhanh số lượng Tổng (Total Quantity) để UI nhảy số ngay lập tức
        setData((prevData) =>
          prevData.map((prod) => {
            if (prod._id === payload.product_id) {
              if (prod.has_variants && prod.variants) {
                const updatedVariants = prod.variants.map((v) =>
                  v.sku === payload.sku
                    ? { ...v, total_stock: payload.new_stock } // Fix: dùng total_stock
                    : v,
                );
                const newTotalQuantity = updatedVariants.reduce(
                  (sum, v) => sum + v.total_stock,
                  0,
                );
                return {
                  ...prod,
                  variants: updatedVariants,
                  total_quantity: newTotalQuantity, // Fix: dùng total_quantity
                };
              } else {
                return {
                  ...prod,
                  total_quantity: payload.new_stock, // Fix: dùng total_quantity
                };
              }
            }
            return prod;
          }),
        );

        // 2. Trigger fetch lại API ngầm ở background để BE tính lại Available Stock & Status Color chuẩn xác
        setRefetchTrigger((prev) => prev + 1);
      },
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  // --- ACTIONS ---
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
    openAdjustModal: (
      productId: string,
      variantSku: string,
      productName: string,
      currentStock: number,
      minStock?: number,
      maxStock?: number,
    ) => {
      setAdjustModal({
        isOpen: true,
        productId,
        variantSku,
        productName,
        currentStock,
        minStock,
        maxStock,
      });
    },
    closeAdjustModal: () => {
      setAdjustModal({
        isOpen: false,
        productId: null,
        variantSku: null,
        productName: "",
        currentStock: 0,
      });
    },
    submitAdjustment: async (payload: AdjustPayload) => {
      try {
        const adjustmentValue =
          payload.type === "add" ? payload.quantity : -payload.quantity;

        await axiosClient.post("/inventory/stock/adjust-manual", {
          product_id: adjustModal.productId,
          sku: adjustModal.variantSku || "",
          adjustment_value: adjustmentValue,
          reason: payload.reason,
        });

        toast.success("Điều chỉnh kho thành công!");
        setAdjustModal({
          isOpen: false,
          productId: null,
          variantSku: null,
          productName: "",
          currentStock: 0,
        });
        setRefetchTrigger((prev) => prev + 1);
      } catch (error: unknown) {
        // SỬA 'any' THÀNH 'unknown'
        console.error(error);

        // Ép kiểu an toàn cho error để lấy message
        const err = error as {
          message?: string;
          response?: { data?: { message?: string } };
        };

        const errorMessage =
          err?.response?.data?.message ||
          err?.message ||
          "Có lỗi xảy ra khi điều chỉnh kho!";
        toast.error(errorMessage);
      }
    },
    submitThresholds: async (payload: ThresholdPayload) => {
      try {
        await axiosClient.post("/inventory/stock/thresholds", {
          product_id: adjustModal.productId,
          sku: adjustModal.variantSku || "",
          min_stock: payload.minStock,
          max_stock: payload.maxStock,
        });

        toast.success("Cập nhật ngưỡng Min/Max thành công!");
        setAdjustModal({
          isOpen: false,
          productId: null,
          variantSku: null,
          productName: "",
          currentStock: 0,
        });
        setRefetchTrigger((prev) => prev + 1);
      } catch (error: unknown) {
        // SỬA 'any' THÀNH 'unknown'
        console.error(error);

        // Ép kiểu an toàn cho error
        const err = error as {
          message?: string;
          response?: { data?: { message?: string } };
        };

        const errorMessage =
          err?.response?.data?.message ||
          err?.message ||
          "Có lỗi xảy ra khi cập nhật ngưỡng!";
        toast.error(errorMessage);
      }
    },
  };

  return {
    data,
    loading,
    filters,
    pagination,
    adjustModal,
    categoriesOptions: categories,
    actions,
  };
}
