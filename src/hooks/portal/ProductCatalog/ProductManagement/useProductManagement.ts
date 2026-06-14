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

export interface ProductVariantItem {
  sku?: string;
  price: number;
  sale_price?: number;
  attributes?: { code: string; value: string }[];
}

export interface Product {
  _id: string;
  thumbnail?: string;
  sku: string;
  name: string;
  status: ProductStatus;
  price: number;
  sale_price?: number;
  currency?: string;
  has_variants?: boolean;
  variants?: ProductVariantItem[];
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

  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    type: "single" | "bulk";
    productId: string | null;
  }>({ isOpen: false, type: "single", productId: null });

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

    let displayPrice =
      p.sale_price && p.sale_price > 0 ? p.sale_price : p.price;
    if (p.has_variants && p.variants && p.variants.length > 0) {
      displayPrice = p.variants.reduce((sum, v) => {
        const vPrice =
          v.sale_price && v.sale_price > 0 ? v.sale_price : v.price;
        return sum + vPrice;
      }, 0);
    }
    const currencyFormat = p.currency || "VND";

    return {
      id: p._id,
      image: p.thumbnail || "",
      sku: p.sku,
      name: p.name,
      status: formattedStatus,
      price: `${displayPrice.toLocaleString()} ${currencyFormat}`,
      selected: selectedIds.includes(p._id),
    };
  });

  const actions = {
    changeFilter: (key: keyof typeof filters, val: string) => {
      setFilters((prev) => ({ ...prev, [key]: val }) as typeof filters);
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
      const newStatusBE = currentStatus === "Active" ? "INACTIVE" : "ACTIVE";

      if (newStatusBE === "ACTIVE") {
        const targetProduct = products.find((p) => p._id === id);
        if (targetProduct && targetProduct.price <= 0) {
          toast.warning(
            "Sản phẩm chưa có giá được duyệt xong (Giá = 0). Không thể kích hoạt!",
          );
          return;
        }
      }

      try {
        await axiosClient.patch(`/products/${id}/status`, {
          status: newStatusBE,
        });
        toast.success("Cập nhật trạng thái thành công");
        fetchProducts();
      } catch (error: unknown) {
        const err = error as { message?: string | string[] };
        const msg = err?.message || "Lỗi khi cập nhật trạng thái";
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
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
        const res = await axiosClient.patch(`/products/bulk/status`, {
          product_ids: selectedIds,
          status: newStatusBE,
        });

        toast.success(res.data?.message || `Đã xử lý hàng loạt thành công.`);
        setSelectedIds([]);
        fetchProducts();
      } catch (error: unknown) {
        const err = error as { message?: string | string[] };
        const msg = err?.message || "Có lỗi xảy ra.";
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
        fetchProducts();
      }
    },

    addProduct: () => navigate("/portal/products/add"),
    viewProduct: (id: string) => navigate(`/portal/products/${id}`),

    // Đã xóa tham số status thừa thãi ở đây
    editProduct: (id: string, status: string) => {
      if (status === "Active") {
        toast.warning("Vui lòng tắt hoạt động (Inactive) trước khi chỉnh sửa!");
        return;
      }
      navigate(`/portal/products/${id}/edit`);
    },

    deleteSingle: (id: string) =>
      setDeleteConfig({ isOpen: true, type: "single", productId: id }),
  };

  const executeDelete = async () => {
    try {
      if (deleteConfig.type === "single" && deleteConfig.productId) {
        await axiosClient.delete(`/products/${deleteConfig.productId}`);
        toast.success("Đã xóa sản phẩm thành công.");
      } else if (deleteConfig.type === "bulk") {
        const res = await axiosClient.delete(`/products/bulk/delete`, {
          data: { product_ids: selectedIds },
        });
        toast.success(res.data?.message || "Đã xóa các sản phẩm được chọn.");
        setSelectedIds([]);
      }

      setDeleteConfig({ isOpen: false, type: "single", productId: null });
      fetchProducts();
    } catch (error: unknown) {
      const err = error as { message?: string | string[] };
      const msg = err?.message || "Đã xảy ra lỗi khi xóa sản phẩm.";
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
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
