import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

export type ProductStatus = "Active" | "Inactive" | "Draft";
export type FilterStatus = "all" | ProductStatus;
export type FilterPrice = "default" | "high_to_low" | "low_to_high";
export type BulkAction = "activate" | "deactivate" | "delete";

export interface ProductRowData {
  id: string;
  image: string;
  sku: string;
  name: string;
  status: ProductStatus;
  price: string;
  selected: boolean;
}

export interface Product {
  _id: string;
  thumbnail?: string;
  sku: string;
  name: string;
  status: ProductStatus;
  price: number;
  sale_price?: number;
}

export interface DropdownOption {
  label: string;
  value: string;
}

export const STATUS_OPTIONS: DropdownOption[] = [
  { label: "All Status", value: "all" },
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
  { label: "Draft", value: "Draft" },
];

export const PRICE_OPTIONS: DropdownOption[] = [
  { label: "Default Sort", value: "default" },
  { label: "Price: High to Low", value: "high_to_low" },
  { label: "Price: Low to High", value: "low_to_high" },
];

export function useProductManagement() {
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [filters, setFilters] = useState<{
    search: string;
    status: FilterStatus;
    price: FilterPrice;
  }>({ search: "", status: "all", price: "default" });

  // BIẾN DEBOUNCE: Lưu giá trị search thực tế sẽ gửi xuống API
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    type: "single" | "bulk";
    productId: string | null;
  }>({ isOpen: false, type: "single", productId: null });

  // XỬ LÝ DEBOUNCE: Đợi người dùng ngừng gõ 500ms mới cập nhật từ khóa và reset page
  useEffect(() => {
    const handler = setTimeout(() => {
      if (debouncedSearch !== filters.search) {
        setDebouncedSearch(filters.search);
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [filters.search, debouncedSearch]);

  const fetchProducts = useCallback(async () => {
    try {
      const params: Record<string, string | number> = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (debouncedSearch) params.keyword = debouncedSearch;

      // FIX: Trạng thái gửi xuống BE bắt buộc phải IN HOA để qua được validator của NestJS
      if (filters.status !== "all")
        params.status = filters.status.toUpperCase();

      if (filters.price === "high_to_low") params.sort = "price_desc";
      if (filters.price === "low_to_high") params.sort = "price_asc";

      const response = await axiosClient.get("/products", { params });
      const { data, meta } = response.data;

      setProducts(data);
      setTotalFiltered(meta.total);
      setTotalPages(meta.totalPages);
    } catch (error) {
      // In lỗi ra console để biến error được sử dụng và dễ dàng debug hơn
      console.error(error);
      toast.error("Không thể tải danh sách sản phẩm.");
    }
  }, [
    debouncedSearch,
    filters.status,
    filters.price,
    pagination.page,
    pagination.limit,
  ]);

  useEffect(() => {
    // Gọi thông qua một hàm trung gian để tránh linter cảnh báo việc set state đồng bộ trong effect
    const loadData = async () => {
      await fetchProducts();
    };
    loadData();
  }, [fetchProducts]);

  const startIndex = (pagination.page - 1) * pagination.limit;
  const endIndex = Math.min(startIndex + pagination.limit, totalFiltered);

  const currentProducts: ProductRowData[] = products.map((p) => {
    const formattedStatus = p.status
      ? ((p.status.charAt(0).toUpperCase() +
          p.status.slice(1).toLowerCase()) as ProductStatus)
      : "Draft";

    return {
      id: p._id,
      image: p.thumbnail || "",
      sku: p.sku,
      name: p.name,
      status: formattedStatus,
      price: `$${(p.sale_price && p.sale_price > 0 ? p.sale_price : p.price).toFixed(2)}`,
      selected: selectedIds.includes(p._id),
    };
  });

  const actions = {
    changeFilter: (key: keyof typeof filters, val: string) => {
      setFilters((prev) => ({ ...prev, [key]: val }) as typeof filters);
      // Nếu không phải là search thì reset trang ngay lập tức (Search đã được xử lý bởi Debounce)
      if (key !== "search") {
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    },
    clearFilter: () => {
      setFilters({ search: "", status: "all", price: "default" });
      setDebouncedSearch("");
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    changePage: (page: number) => setPagination((prev) => ({ ...prev, page })),
    changeLimit: (limit: number) => setPagination({ page: 1, limit }),

    selectProduct: (id: string) => {
      setSelectedIds((prev) =>
        prev.includes(id)
          ? prev.filter((itemId) => itemId !== id)
          : [...prev, id],
      );
    },
    selectAll: (isAllSelected: boolean) => {
      const currentViewIds = currentProducts.map((p) => p.id);
      if (isAllSelected) {
        setSelectedIds((prev) =>
          prev.filter((id) => !currentViewIds.includes(id)),
        );
      } else {
        setSelectedIds((prev) =>
          Array.from(new Set([...prev, ...currentViewIds])),
        );
      }
    },

    toggleStatus: async (id: string, currentStatus: string) => {
      if (currentStatus === "Draft") return;
      // FIX: Payload cập nhật trạng thái BE phải IN HOA
      const newStatusBE = currentStatus === "Active" ? "INACTIVE" : "ACTIVE";

      try {
        await axiosClient.patch(`/products/${id}/status`, {
          status: newStatusBE,
        });
        toast.success("Cập nhật trạng thái thành công");
        fetchProducts();
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Lỗi khi cập nhật trạng thái";
        toast.error(errorMessage);
      }
    },

    bulk: async (action: BulkAction) => {
      if (selectedIds.length === 0) {
        toast.warning("Vui lòng chọn ít nhất 1 sản phẩm.");
        return;
      }
      if (action === "delete") {
        setDeleteConfig({ isOpen: true, type: "bulk", productId: null });
        return;
      }

      const newStatusBE = action === "activate" ? "ACTIVE" : "INACTIVE";
      try {
        // GỌI DUY NHẤT 1 REQUEST BULK XUỐNG BE MỚI
        const res = await axiosClient.patch(`/products/bulk/status`, {
          product_ids: selectedIds,
          status: newStatusBE,
        });

        toast.success(res.data?.message || `Đã xử lý hàng loạt thành công.`);
        setSelectedIds([]); // Clear selection
        fetchProducts(); // Refresh data
      } catch (error) {
        console.error(error);
        toast.error(
          "Có lỗi xảy ra. Một số sản phẩm có thể không đủ điều kiện (thiếu giá, ảnh).",
        );
        fetchProducts();
      }
    },

    addProduct: () => navigate("/portal/products/add"),
    viewProduct: (id: string) => navigate(`/portal/products/${id}`),
    editProduct: (id: string) => navigate(`/portal/products/${id}/edit`),
    deleteSingle: (id: string) =>
      setDeleteConfig({ isOpen: true, type: "single", productId: id }),
  };

  const executeDelete = async () => {
    try {
      if (deleteConfig.type === "single" && deleteConfig.productId) {
        await axiosClient.delete(`/products/${deleteConfig.productId}`);
        toast.success("Đã xóa sản phẩm thành công.");
      } else if (deleteConfig.type === "bulk") {
        // GỌI DUY NHẤT 1 REQUEST BULK DELETE XUỐNG BE
        const res = await axiosClient.delete(`/products/bulk/delete`, {
          data: { product_ids: selectedIds },
        });
        toast.success(res.data?.message || "Đã xóa các sản phẩm được chọn.");
        setSelectedIds([]);
      }

      setDeleteConfig({ isOpen: false, type: "single", productId: null });
      fetchProducts();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Lỗi khi xóa sản phẩm. Có thể SP đã phát sinh đơn hàng.";
      toast.error(errorMessage);
      setDeleteConfig({ isOpen: false, type: "single", productId: null });
    }
  };

  return {
    currentProducts,
    filters,
    pagination,
    totalPages,
    startIndex,
    endIndex,
    totalFiltered,
    deleteConfig,
    setDeleteConfig,
    actions,
    executeDelete,
  };
}
