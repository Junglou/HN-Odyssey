import VariantManagement from "../../../../components/portal/ProductCatalog/VariantManagement/VariantManagement";
import VariantDrawer from "../../../../components/portal/ProductCatalog/VariantManagement/VariantDrawer";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import { useVariantManagement } from "../../../../hooks/portal/ProductCatalog/VariantManagement/useVariantManagement";
import "./VariantManagementPage.css";

// container gọi hook và ném data xuống component giao diện
export default function VariantManagementPage() {
  const {
    filteredVariants,
    search,
    drawerConfig,
    deleteConfig,
    actions,
    handleDrawerSubmit,
    executeDelete,
  } = useVariantManagement();

  return (
    <div className="vm-page-container">
      {/* component danh sách biến thể */}
      <VariantManagement
        data={filteredVariants}
        search={search}
        actions={actions}
      />

      {/* drawer thêm/sửa biến thể */}
      <VariantDrawer
        isOpen={drawerConfig.isOpen}
        mode={drawerConfig.mode}
        initialData={drawerConfig.editingVariant}
        isSubmitting={drawerConfig.isSubmitting}
        onClose={actions.closeDrawer}
        onSubmit={handleDrawerSubmit}
      />

      {/* modal xác nhận xóa */}
      <ConfirmDeleteModal
        isOpen={deleteConfig.isOpen}
        message="Are you sure you want to delete this variant?"
        onClose={actions.closeDeleteModal}
        onConfirm={executeDelete}
      />
    </div>
  );
}
