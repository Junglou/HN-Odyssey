import StaticPageManagement from "../../../../components/portal/Communication/StaticPageManagement/StaticPageManagement";
import StaticPageModal from "../../../../components/portal/Communication/StaticPageManagement/StaticPageModal";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import { useStaticPageManagement } from "../../../../hooks/portal/Communication/StaticPageManagement/useStaticPageManagement";
import "./StaticPageManagementPage.css";

export default function StaticPageManagementPage() {
  const {
    currentRecords,
    pagination,
    search,
    statusFilter,
    typeFilter,
    selectedIds,
    modalConfig,
    actions,
    handleModalSubmit,
    bulkActions,
  } = useStaticPageManagement();

  return (
    <div className="sp-page-container">
      <StaticPageManagement
        data={currentRecords}
        pagination={pagination}
        search={search}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        selectedIds={selectedIds}
        actions={actions}
        bulkActions={bulkActions}
      />

      <StaticPageModal
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

      {modalConfig.mode === "delete" && (
        <ConfirmDeleteModal
          isOpen={modalConfig.isOpen}
          message={
            modalConfig.editingRecord
              ? `Are you sure you want to delete page "${modalConfig.editingRecord.title}"?`
              : `Are you sure you want to delete ${selectedIds.size} selected pages?`
          }
          onClose={actions.closeModal}
          onConfirm={actions.handleConfirmDelete}
        />
      )}
    </div>
  );
}
