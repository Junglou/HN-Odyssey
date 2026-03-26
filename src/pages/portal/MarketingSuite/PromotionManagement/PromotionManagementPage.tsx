import PromotionManagement from "../../../../components/portal/MarketingSuite/PromotionManagement/PromotionManagement";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import PromotionModal from "../../../../components/portal/MarketingSuite/PromotionManagement/PromotionModal";
import { usePromotionManagement } from "../../../../hooks/portal/MarketingSuite/PromotionManagement/usePromotionManagement";
import "./PromotionManagementPage.css";

export default function PromotionManagementPage() {
  const {
    currentRecords,
    pagination,
    search,
    statusFilter,
    typeFilter,
    selectedIds,
    modalConfig,
    actions,
    bulkActions,
    handleModalSubmit,
  } = usePromotionManagement();

  return (
    <div className="promo-page-container">
      <PromotionManagement
        data={currentRecords}
        pagination={pagination}
        search={search}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        selectedIds={selectedIds}
        actions={actions}
        bulkActions={bulkActions}
      />

      <PromotionModal
        isOpen={
          modalConfig.isOpen &&
          (modalConfig.mode === "add" ||
            modalConfig.mode === "edit" ||
            modalConfig.mode === "view")
        }
        mode={modalConfig.mode}
        initialData={modalConfig.editingRecord}
        onClose={actions.closeModal}
        onSubmit={handleModalSubmit}
      />

      {modalConfig.mode === "delete" && (
        <ConfirmDeleteModal
          isOpen={modalConfig.isOpen}
          message={
            modalConfig.editingRecord
              ? `Are you sure you want to delete promotion "${modalConfig.editingRecord.name}"?`
              : `Are you sure you want to delete ${selectedIds.size} selected promotions?`
          }
          onClose={actions.closeModal}
          onConfirm={actions.handleConfirmDelete}
        />
      )}
    </div>
  );
}
