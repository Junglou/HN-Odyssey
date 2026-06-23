import ReviewAndRatingManagement from "../../../../components/portal/MarketingSuite/ReviewAndRatingManagement/ReviewAndRatingManagement";
import ReviewAndRatingDrawer from "../../../../components/portal/MarketingSuite/ReviewAndRatingManagement/ReviewAndRatingDrawer";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import { useReviewAndRatingManagement } from "../../../../hooks/portal/MarketingSuite/ReviewAndRatingManagement/useReviewAndRatingManagement";
import "./ReviewAndRatingManagementPage.css";

export default function ReviewAndRatingManagementPage() {
  const {
    currentRecords,
    pagination,
    search,
    statusFilter,
    ratingFilter,
    selectedIds,
    drawerConfig,
    modalConfig,
    actions,
    bulkActions,
  } = useReviewAndRatingManagement();

  return (
    <div className="rarm-page-container">
      {/* component bảng */}
      <ReviewAndRatingManagement
        data={currentRecords}
        search={search}
        statusFilter={statusFilter}
        ratingFilter={ratingFilter}
        selectedIds={selectedIds}
        pagination={pagination}
        actions={actions}
        bulkActions={bulkActions}
      />

      {/* drawer */}
      <ReviewAndRatingDrawer
        isOpen={drawerConfig.isOpen}
        review={drawerConfig.selectedReview}
        mode={drawerConfig.mode}
        onClose={actions.closeDrawer}
        onSave={actions.saveReviewChanges}
      />

      {/* modal delete */}
      {modalConfig.mode === "delete" && (
        <ConfirmDeleteModal
          isOpen={modalConfig.isOpen}
          message={
            modalConfig.editingRecord
              ? `Are you sure you want to delete review for "${modalConfig.editingRecord.productName}"?`
              : `Are you sure you want to delete ${selectedIds.size} selected reviews?`
          }
          onClose={actions.closeModal}
          onConfirm={actions.handleConfirmDelete}
        />
      )}
    </div>
  );
}
