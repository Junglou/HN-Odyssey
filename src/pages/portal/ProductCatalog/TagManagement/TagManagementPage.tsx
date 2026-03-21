import TagManagement from "../../../../components/portal/ProductCatalog/TagManagement/TagManagement";
import TagDrawer from "../../../../components/portal/ProductCatalog/TagManagement/TagDrawer";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import { useTagManagement } from "../../../../hooks/portal/ProductCatalog/TagManagement/useTagManagement";
import "./TagManagementPage.css";

// container gọi hook và truyền data xuống view
export default function TagManagementPage() {
  const {
    filteredTags,
    search,
    drawerConfig,
    deleteConfig,
    setDeleteConfig,
    actions,
    handleDrawerSubmit,
    executeDelete,
  } = useTagManagement();

  return (
    <div className="tm-page-container">
      {/* component chính hiển thị danh sách tag */}
      <TagManagement data={filteredTags} search={search} actions={actions} />

      {/* thanh trượt thêm/sửa tag */}
      <TagDrawer
        isOpen={drawerConfig.isOpen}
        mode={drawerConfig.mode}
        initialData={drawerConfig.editingTag}
        onClose={actions.closeDrawer}
        onSubmit={handleDrawerSubmit}
      />

      {/* tái sử dụng modal xác nhận xóa */}
      <ConfirmDeleteModal
        isOpen={deleteConfig.isOpen}
        message="Are you sure you want to delete this tag?"
        onClose={() => setDeleteConfig({ isOpen: false, tagId: null })}
        onConfirm={executeDelete}
      />
    </div>
  );
}
