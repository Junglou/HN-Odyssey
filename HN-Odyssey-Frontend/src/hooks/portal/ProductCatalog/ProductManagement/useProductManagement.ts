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
  stock?: number;
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
  stock?: number;
  currency?: string;
  has_variants?: boolean;
  variants?: ProductVariantItem[];
}

export interface ApiErrorResponse {
  response?: {
    data?: {
      message?: string | string[];
    };
  };
  message?: string;
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
    }, 300);
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

    const displayPrice =
      p.sale_price && p.sale_price > 0 ? p.sale_price : p.price;
    const currencyFormat = p.currency || "USD";

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
        if (targetProduct) {
          if (!targetProduct.has_variants) {
            // Kiểm tra giá của sản phẩm đơn
            if (targetProduct.price <= 0) {
              toast.warning(
                "Sản phẩm chưa có giá được duyệt xong (Giá = 0). Không thể kích hoạt!",
              );
              return;
            }
            // Kiểm tra số lượng tồn kho của sản phẩm đơn
            if ((targetProduct.stock || 0) <= 0) {
              toast.warning(
                "Sản phẩm chưa được nhập kho (Số lượng = 0). Không thể kích hoạt!",
              );
              return;
            }
          } else {
            // Kiểm tra gộp cho sản phẩm biến thể: ít nhất 1 biến thể phải hoàn thiện cả giá lẫn kho
            const hasValidVariant = targetProduct.variants?.some(
              (v) => (v.price || 0) > 0 && (v.stock || 0) > 0,
            );

            if (!hasValidVariant) {
              toast.warning(
                "Sản phẩm phải có ít nhất một biến thể thoả mãn CẢ 2 ĐIỀU KIỆN (giá > 0 VÀ tồn kho > 0) mới được phép kích hoạt!",
              );
              return;
            }
          }
        }
      }

      try {
        await axiosClient.patch(`/products/${id}/status`, {
          status: newStatusBE,
        });
        toast.success("Cập nhật trạng thái thành công");
        fetchProducts();
      } catch (error: unknown) {
        // Ép kiểu an toàn thông qua Interface đã khai báo để tránh eslint báo lỗi any
        const err = error as ApiErrorResponse;
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Lỗi khi cập nhật trạng thái";
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
      let validIdsToUpdate = [...selectedIds];

      // thực hiện lọc loại trừ trước khi đẩy dữ liệu xuống máy chủ
      if (newStatusBE === "ACTIVE") {
        const invalidSkus: string[] = [];

        validIdsToUpdate = selectedIds.filter((id) => {
          const targetProduct = products.find((p) => p._id === id);
          if (!targetProduct) return false;

          if (!targetProduct.has_variants) {
            if (targetProduct.price <= 0 || (targetProduct.stock || 0) <= 0) {
              invalidSkus.push(targetProduct.sku);
              return false;
            }
          } else {
            const hasValidVariant = targetProduct.variants?.some(
              (v) => (v.price || 0) > 0 && (v.stock || 0) > 0,
            );
            if (!hasValidVariant) {
              invalidSkus.push(targetProduct.sku);
              return false;
            }
          }
          return true;
        });

        if (invalidSkus.length > 0) {
          toast.warning(
            `Các sản phẩm sau bị loại khỏi danh sách kích hoạt do chưa đủ điều kiện (giá = 0 hoặc tồn kho = 0): ${invalidSkus.join(", ")}`,
          );
        }

        // chặn tiến trình gọi api nếu danh sách lọc không còn sản phẩm nào hợp lệ
        if (validIdsToUpdate.length === 0) {
          return;
        }
      }

      try {
        const res = await axiosClient.patch(`/products/bulk/status`, {
          product_ids: validIdsToUpdate,
          status: newStatusBE,
        });

        toast.success(res.data?.message || "Đã xử lý hàng loạt thành công.");
        setSelectedIds([]);
        fetchProducts();
      } catch (error: unknown) {
        // trích xuất và hiển thị chính xác nguyên nhân từ chối trả về từ máy chủ
        const err = error as ApiErrorResponse;
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Có lỗi xảy ra trong quá trình xử lý.";

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
