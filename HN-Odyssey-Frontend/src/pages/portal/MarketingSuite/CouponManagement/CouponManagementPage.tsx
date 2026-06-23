import CouponManagement from "../../../../components/portal/MarketingSuite/CouponManagement/CouponManagement";
import CouponModal from "../../../../components/portal/MarketingSuite/CouponManagement/CouponModal";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import { useCouponManagement } from "../../../../hooks/portal/MarketingSuite/CouponManagement/useCouponManagement";
import "./CouponManagementPage.css";

export default function CouponManagementPage() {
  const {
    currentRecords,
    pagination,
    search,
    statusFilter,
    discountTypeFilter,
    selectedIds,
    modalConfig,
    actions,
    handleModalSubmit,
    bulkActions,
  } = useCouponManagement();

  return (
    <div className="coupon-page-container">
      {/* component bảng và thanh công cụ chính */}
      <CouponManagement
        data={currentRecords}
        pagination={pagination}
        search={search}
        statusFilter={statusFilter}
        discountTypeFilter={discountTypeFilter}
        selectedIds={selectedIds}
        actions={actions}
        bulkActions={bulkActions}
      />

      {/* modal thao tác thêm/sửa/xem chi tiết */}
      <CouponModal
        isOpen={
          modalConfig.isOpen &&
          (modalConfig.mode === "add" ||
            modalConfig.mode === "edit" ||
            modalConfig.mode === "view")
        }
        mode={modalConfig.mode as "add" | "edit" | "view"}
        initialData={modalConfig.editingRecord}
        onClose={actions.closeModal}
        onSubmit={handleModalSubmit}
      />

      {/* modal xác nhận xóa dùng chung của hệ thống */}
      {modalConfig.mode === "delete" && (
        <ConfirmDeleteModal
          isOpen={modalConfig.isOpen}
          message={
            modalConfig.editingRecord
              ? `Are you sure you want to delete coupon code "${modalConfig.editingRecord.code}"?`
              : `Are you sure you want to delete ${selectedIds.size} selected coupons?`
          }
          onClose={actions.closeModal}
          onConfirm={actions.handleConfirmDelete}
        />
      )}
    </div>
  );
}
