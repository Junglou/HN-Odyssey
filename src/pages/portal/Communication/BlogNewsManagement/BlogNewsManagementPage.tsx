import BlogNewsManagement from "../../../../components/portal/Communication/BlogNewsManagement/BlogNewsManagement";
import BlogNewsDrawer from "../../../../components/portal/Communication/BlogNewsManagement/BlogNewsDrawer";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import { useBlogNewsManagement } from "../../../../hooks/portal/Communication/BlogNewsManagement/useBlogNewsManagement";
import "./BlogNewsManagementPage.css";

export default function BlogNewsManagementPage() {
  const {
    records,
    pagination,
    search,
    statusFilter,
    selectedIds,
    drawerConfig,
    deleteModalConfig,
    actions,
    bulkActions,
  } = useBlogNewsManagement();

  return (
    <div className="ban-page-container">
      {/* Component chính: Bảng và Bộ lọc */}
      <BlogNewsManagement
        data={records}
        search={search}
        statusFilter={statusFilter}
        selectedIds={selectedIds}
        pagination={pagination}
        actions={actions}
        bulkActions={bulkActions}
      />

      {/* Component Ngăn kéo thêm/sửa bài viết */}
      <BlogNewsDrawer
        isOpen={drawerConfig.isOpen}
        mode={drawerConfig.mode}
        initialData={drawerConfig.editingRecord}
        isSubmitting={drawerConfig.isSubmitting}
        onClose={actions.closeDrawer}
        onSubmit={actions.handleDrawerSubmit}
      />

      {/* Modal xác nhận xóa chuẩn */}
      {deleteModalConfig.isOpen && (
        <ConfirmDeleteModal
          isOpen={deleteModalConfig.isOpen}
          message={
            deleteModalConfig.isBulk
              ? `Are you sure you want to delete ${selectedIds.size} selected posts?`
              : "Are you sure you want to delete this post?"
          }
          onClose={actions.closeDeleteModal}
          onConfirm={actions.handleConfirmDelete}
        />
      )}
    </div>
  );
}
