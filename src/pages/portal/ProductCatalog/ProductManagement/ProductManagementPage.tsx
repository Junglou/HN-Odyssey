import ProductManagement from "../../../../components/portal/ProductCatalog/ProductManagement/ProductManagement";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import { useProductManagement } from "../../../../hooks/portal/ProductCatalog/ProductManagement/useProductManagement";
import "./ProductManagementPage.css";

export default function ProductManagementPage() {
  const {
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
  } = useProductManagement();

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
          totalFiltered,
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
