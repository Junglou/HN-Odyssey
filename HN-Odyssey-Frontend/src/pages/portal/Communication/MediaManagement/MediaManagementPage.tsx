import MediaManagement from "../../../../components/portal/Communication/MediaManagement/MediaManagement";
import MediaUploadDrawer from "../../../../components/portal/Communication/MediaManagement/MediaUploadDrawer";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import MediaCropModal from "../../../../components/portal/Communication/MediaManagement/MediaCropModal";
import { useMediaManagement } from "../../../../hooks/portal/Communication/MediaManagement/useMediaManagement";
import "./MediaManagementPage.css";

export default function MediaManagementPage() {
  const {
    currentRecords,
    pagination,
    search,
    statusFilter,
    typeFilter,
    drawerConfig,
    deleteModalConfig,
    cropModalConfig,
    actions,
    handleDrawerSubmit,
    searchTargets,
    resolveTargetName,
  } = useMediaManagement();

  return (
    <div className="mm-page-container">
      {/* Component chính vẽ giao diện và lưới dữ liệu */}
      <MediaManagement
        data={currentRecords}
        pagination={pagination}
        search={search}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        actions={actions}
      />

      {/* Render Drawer trượt từ bên phải */}
      <MediaUploadDrawer
        isOpen={drawerConfig.isOpen}
        mode={drawerConfig.mode}
        uploadDrafts={drawerConfig.uploadDrafts}
        previewUrl={drawerConfig.previewUrl}
        initialData={drawerConfig.editingRecord}
        isSubmitting={drawerConfig.isSubmitting}
        onClose={actions.closeDrawer}
        onSubmit={handleDrawerSubmit}
        searchTargets={searchTargets}
        resolveTargetName={resolveTargetName}
      />

      {/* Render modal xác nhận xóa chuẩn */}
      {deleteModalConfig.isOpen && (
        <ConfirmDeleteModal
          isOpen={deleteModalConfig.isOpen}
          message="Are you sure you want to delete this media?"
          onClose={actions.closeDeleteModal}
          onConfirm={actions.handleConfirmDelete}
        />
      )}

      {/* Render Modal cắt ảnh (Crop) */}
      <MediaCropModal
        isOpen={cropModalConfig.isOpen}
        mediaRecord={cropModalConfig.mediaRecord}
        onClose={actions.closeCropModal}
        onSave={actions.handleCropSave}
      />
    </div>
  );
}
