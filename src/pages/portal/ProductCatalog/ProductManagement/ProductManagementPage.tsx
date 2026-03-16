import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ProductManagement, {
  type ProductStatus,
  type FilterStatus,
  type FilterPrice,
  type BulkAction,
  type ProductRowData,
} from "../../../../components/portal/ProductCatalog/ProductManagement/ProductManagement";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import "./ProductManagementPage.css";
import { toast } from "react-toastify";

// model data gốc
export interface Product {
  id: number;
  image: string;
  sku: string;
  name: string;
  status: ProductStatus;
  price: number;
}

// mock data đa dạng chờ nối api
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

// page container logic danh sách sản phẩm
export default function ProductManagementPage() {
  const navigate = useNavigate();

  // state data sản phẩm
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // object lưu config bộ lọc hiện tại
  const [filters, setFilters] = useState<{
    search: string;
    status: FilterStatus;
    price: FilterPrice;
  }>({ search: "", status: "all", price: "default" });

  // tracking chỉ số phân trang
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    type: "single" | "bulk";
    productId: number | null;
  }>({ isOpen: false, type: "single", productId: null });

  // filter và sort data
  const filteredProducts = useMemo(() => {
    const result = products.filter((prod) => {
      const matchesSearch =
        prod.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        prod.sku.toLowerCase().includes(filters.search.toLowerCase());
      const matchesStatus =
        filters.status === "all" || prod.status === filters.status;
      return matchesSearch && matchesStatus;
    });

    // xử lý sort cho price
    if (filters.price === "high_to_low") {
      result.sort((a, b) => b.price - a.price);
    } else if (filters.price === "low_to_high") {
      result.sort((a, b) => a.price - b.price);
    }

    return result;
  }, [products, filters]);

  const totalPages = Math.ceil(filteredProducts.length / pagination.limit);
  const startIndex = (pagination.page - 1) * pagination.limit;
  const endIndex = startIndex + pagination.limit;
  const currentProducts: ProductRowData[] = filteredProducts
    .slice(startIndex, endIndex)
    .map((p) => ({
      ...p,
      price: `$${p.price.toFixed(2)}`,
      selected: selectedIds.includes(p.id),
    }));
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
        // bỏ check toàn bộ trên trang hiện hành
        setSelectedIds((prev) =>
          prev.filter((id) => !currentViewIds.includes(id)),
        );
      } else {
        // gộp id trang hiện tại vào mảng selected
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

    // trigger hành động hàng loạt
    bulk: (action: BulkAction) => {
      if (selectedIds.length === 0) {
        toast.warning("Vui lòng chọn ít nhất 1 sản phẩm.");
        return;
      }
      if (action === "delete") {
        setDeleteConfig({ isOpen: true, type: "bulk", productId: null });
        return;
      }
      // loop update status cho các hàng đang tick (trừ nháp)
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

    addProduct: () => {
      navigate("/portal/products/add");
    },
    viewProduct: (id: number) => {
      navigate(`/portal/products/${id}`);
    },
    editProduct: (id: number) => {
      navigate(`/portal/products/${id}/edit`);
    },
    deleteSingle: (id: number) =>
      setDeleteConfig({ isOpen: true, type: "single", productId: id }),
  };

  // commit xóa khỏi list gốc (func update)
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
      setSelectedIds([]); // xả rỗng list tick
    }
    setDeleteConfig({ isOpen: false, type: "single", productId: null });
    toast.success("Đã xóa dữ liệu thành công.");
  };

  return (
    <div className="pm-page-container">
      <ProductManagement
        data={currentProducts}
        filters={filters}
        pagination={{
          page: pagination.page,
          limit: pagination.limit,
          totalPages,
          startIndex,
          endIndex,
          totalFiltered: filteredProducts.length,
        }}
        actions={actions}
      />

      <ConfirmDeleteModal
        isOpen={deleteConfig.isOpen}
        message={
          deleteConfig.type === "single"
            ? "Bạn có chắc chắn muốn xóa sản phẩm này?"
            : "Xóa các sản phẩm đã chọn?"
        }
        onClose={() =>
          setDeleteConfig({ isOpen: false, type: "single", productId: null })
        }
        onConfirm={executeDelete}
      />
    </div>
  );
}
