import VariantManagement from "../../../../components/portal/ProductCatalog/VariantManagement/VariantManagement";
import VariantDrawer from "../../../../components/portal/ProductCatalog/VariantManagement/VariantDrawer";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import { useVariantManagement } from "../../../../hooks/portal/ProductCatalog/VariantManagement/useVariantManagement";
import "./VariantManagementPage.css";

// view
export default function VariantManagementPage() {
  const {
    attributes,
    search,
    drawerConfig,
    deleteConfig,
    actions,
    handleSaveAttribute,
    executeDelete,
  } = useVariantManagement();

  return (
    <div className="vm-page-container">
      {/* component chính hiển thị danh sách thuộc tính */}
      <VariantManagement data={attributes} search={search} actions={actions} />

      {/* thanh trượt thêm/sửa thuộc tính */}
      <VariantDrawer
        isOpen={drawerConfig.isOpen}
        mode={drawerConfig.mode}
        initialData={drawerConfig.editingAttribute}
        isSubmitting={drawerConfig.isSubmitting}
        onClose={actions.closeDrawer}
        onSubmit={handleSaveAttribute}
      />

      {/* popup xác nhận xóa */}
      <ConfirmDeleteModal
        isOpen={deleteConfig.isOpen}
        message="Are you sure you want to delete this attribute?"
        onClose={actions.closeDeleteModal}
        onConfirm={executeDelete}
      />
    </div>
  );
}
