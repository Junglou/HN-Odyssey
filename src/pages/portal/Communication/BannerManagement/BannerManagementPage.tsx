import BannerManagement from "../../../../components/portal/Communication/BannerManagement/BannerManagement";
import BannerDrawer from "../../../../components/portal/Communication/BannerManagement/BannerDrawer";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import { useBannerManagement } from "../../../../hooks/portal/Communication/BannerManagement/useBannerManagement";
import "./BannerManagementPage.css";

export default function BannerManagementPage() {
  // Lấy dữ liệu và các hàm xử lý từ hook
  const {
    currentRecords,
    selectedIds,
    pagination,
    search,
    statusFilter,
    positionFilter,
    drawerConfig,
    deleteModalConfig,
    actions,
    handleDrawerSubmit,
  } = useBannerManagement();

  // Nội dung cảnh báo xóa
  const deleteMessage =
    deleteModalConfig.idsToDelete.length > 1
      ? `Are you sure you want to delete ${deleteModalConfig.idsToDelete.length} selected banners? This action cannot be undone.`
      : "Are you sure you want to delete this banner? This action cannot be undone.";

  return (
    <div className="bm-page-container">
      {/* Bảng dữ liệu chính */}
      <BannerManagement
        data={currentRecords}
        selectedIds={selectedIds}
        search={search}
        statusFilter={statusFilter}
        positionFilter={positionFilter}
        pagination={pagination}
        actions={actions}
      />

      {/* Form thêm/sửa chi tiết */}
      <BannerDrawer
        isOpen={drawerConfig.isOpen}
        mode={drawerConfig.mode}
        initialData={drawerConfig.record}
        onClose={actions.closeDrawer}
        onSubmit={handleDrawerSubmit}
      />

      {/* Modal xác nhận xóa */}
      <ConfirmDeleteModal
        isOpen={deleteModalConfig.isOpen}
        message={deleteMessage}
        onConfirm={actions.confirmDelete}
        onClose={actions.closeDeleteModal}
      />
    </div>
  );
}
