import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

// interface và type
export type ProductStatus = "Active" | "Inactive" | "Draft";
export type FilterStatus = "all" | ProductStatus;
export type FilterPrice = "default" | "high_to_low" | "low_to_high";
export type BulkAction = "activate" | "deactivate" | "delete";

export interface ProductRowData {
  id: number;
  image: string;
  sku: string;
  name: string;
  status: ProductStatus;
  price: string;
  selected: boolean;
}

export interface Product {
  id: number;
  image: string;
  sku: string;
  name: string;
  status: ProductStatus;
  price: number;
}

export interface DropdownOption {
  label: string;
  value: string;
}

// mock data
export const STATUS_OPTIONS: DropdownOption[] = [
  { label: "All Status", value: "all" },
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
  { label: "Draft", value: "Draft" },
];

export const PRICE_OPTIONS: DropdownOption[] = [
  { label: "Default Price", value: "default" },
  { label: "High to Low", value: "high_to_low" },
  { label: "Low to High", value: "low_to_high" },
];

export const PAGE_OPTIONS: DropdownOption[] = [
  { label: "10 / page", value: "10" },
  { label: "20 / page", value: "20" },
  { label: "50 / page", value: "50" },
];

// mock data
const INITIAL_PRODUCTS: Product[] = [
  {
    id: 1,
    image: "",
    sku: "CWT-001",
    name: "Grey Slim Jacket",
    status: "Active",
    price: 20.5,
  },
  {
    id: 2,
    image: "",
    sku: "SHR-012",
    name: "Classic White Shirt",
    status: "Inactive",
    price: 15.0,
  },
  {
    id: 3,
    image: "",
    sku: "PNT-008",
    name: "Denim Jeans",
    status: "Draft",
    price: 35.0,
  },
  {
    id: 4,
    image: "",
    sku: "SHS-004",
    name: "Running Sneakers",
    status: "Active",
    price: 50.0,
  },
  {
    id: 5,
    image: "",
    sku: "ACC-099",
    name: "Leather Belt",
    status: "Inactive",
    price: 12.0,
  },
  {
    id: 6,
    image: "",
    sku: "HAT-002",
    name: "Summer Fedora",
    status: "Draft",
    price: 8.5,
  },
];

export function useProductManagement() {
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // state quản lý lọc, phân trang, và cấu hình xóa
  const [filters, setFilters] = useState<{
    search: string;
    status: FilterStatus;
    price: FilterPrice;
  }>({ search: "", status: "all", price: "default" });

  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    type: "single" | "bulk";
    productId: number | null;
  }>({ isOpen: false, type: "single", productId: null });

  // xử lý lọc và sắp xếp dữ liệu
  const filteredProducts = useMemo(() => {
    const result = products.filter((prod) => {
      const matchesSearch =
        prod.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        prod.sku.toLowerCase().includes(filters.search.toLowerCase());
      const matchesStatus =
        filters.status === "all" || prod.status === filters.status;
      return matchesSearch && matchesStatus;
    });

    // sắp xếp theo giá
    if (filters.price === "high_to_low") {
      result.sort((a, b) => b.price - a.price);
    } else if (filters.price === "low_to_high") {
      result.sort((a, b) => a.price - b.price);
    }
    return result;
  }, [products, filters]);

  // tính toán các chỉ số phân trang
  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / pagination.limit),
  );
  const startIndex = (pagination.page - 1) * pagination.limit;
  const endIndex = Math.min(
    startIndex + pagination.limit,
    filteredProducts.length,
  );

  // format dữ liệu cho hàng hiển thị
  const currentProducts: ProductRowData[] = filteredProducts
    .slice(startIndex, endIndex)
    .map((p) => ({
      ...p,
      price: `$${p.price.toFixed(2)}`,
      selected: selectedIds.includes(p.id),
    }));

  // nhóm các hàm xử lý hành động truyền xuống component giao diện
  const actions = {
    changeFilter: (key: keyof typeof filters, val: string) => {
      setFilters((prev) => ({ ...prev, [key]: val }) as typeof filters);
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    clearFilter: () => {
      setFilters({ search: "", status: "all", price: "default" });
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    changePage: (page: number) => setPagination((prev) => ({ ...prev, page })),
    changeLimit: (limit: number) => setPagination({ page: 1, limit }),

    selectProduct: (id: number) => {
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
    toggleStatus: (id: number, currentStatus: string) => {
      if (currentStatus === "Draft") return;
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: currentStatus === "Active" ? "Inactive" : "Active",
              }
            : p,
        ),
      );
    },
    bulk: (action: BulkAction) => {
      if (selectedIds.length === 0) {
        toast.warning("Vui lòng chọn ít nhất 1 sản phẩm.");
        return;
      }
      if (action === "delete") {
        setDeleteConfig({ isOpen: true, type: "bulk", productId: null });
        return;
      }
      setProducts((prev) =>
        prev.map((p) => {
          if (selectedIds.includes(p.id) && p.status !== "Draft") {
            return {
              ...p,
              status: action === "activate" ? "Active" : "Inactive",
            };
          }
          return p;
        }),
      );
      toast.success(
        `Đã ${action === "activate" ? "kích hoạt" : "vô hiệu hóa"} sản phẩm.`,
      );
    },
    addProduct: () => navigate("/portal/products/add"),
    viewProduct: (id: number) => navigate(`/portal/products/${id}`),
    editProduct: (id: number) => navigate(`/portal/products/${id}/edit`),
    deleteSingle: (id: number) =>
      setDeleteConfig({ isOpen: true, type: "single", productId: id }),
  };

  const executeDelete = () => {
    if (deleteConfig.type === "single") {
      setProducts((prev) =>
        prev.filter((p) => p.id !== deleteConfig.productId),
      );
      setSelectedIds((prev) =>
        prev.filter((id) => id !== deleteConfig.productId),
      );
    } else {
      setProducts((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
      setSelectedIds([]);
    }
    setDeleteConfig({ isOpen: false, type: "single", productId: null });
    toast.success("Đã xóa dữ liệu thành công.");
  };

  return {
    currentProducts,
    filters,
    pagination,
    totalPages,
    startIndex,
    endIndex,
    totalFiltered: filteredProducts.length,
    deleteConfig,
    setDeleteConfig,
    actions,
    executeDelete,
  };
}
