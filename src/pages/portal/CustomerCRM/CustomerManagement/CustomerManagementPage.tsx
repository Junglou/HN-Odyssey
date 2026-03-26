import CustomerManagement from "../../../../components/portal/CustomerCRM/CustomerManagement/CustomerManagement";
import CustomerModal from "../../../../components/portal/CustomerCRM/CustomerManagement/CustomerModal";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import { useCustomerManagement } from "../../../../hooks/portal/CustomerCRM/CustomerManagement/useCustomerManagement";
import "./CustomerManagementPage.css";

export default function CustomerManagementPage() {
  const {
    currentRecords,
    pagination,
    search,
    statusFilter,
    typeFilter,
    selectedIds,
    modalConfig,
    actions,
    toggleRowStatus,
    handleModalSubmit,
    bulkActions,
  } = useCustomerManagement();

  return (
    <div className="crm-page-container">
      {/* component chính */}
      <CustomerManagement
        data={currentRecords}
        pagination={pagination}
        search={search}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        selectedIds={selectedIds}
        actions={actions}
        toggleRowStatus={toggleRowStatus}
        bulkActions={bulkActions}
      />

      {/* modal */}
      {(modalConfig.mode === "add" ||
        modalConfig.mode === "edit" ||
        modalConfig.mode === "view") && (
        <CustomerModal
          isOpen={modalConfig.isOpen}
          mode={modalConfig.mode as "add" | "edit" | "view"}
          initialData={modalConfig.editingRecord}
          isSubmitting={modalConfig.isSubmitting}
          onClose={actions.closeModal}
          onSubmit={handleModalSubmit}
        />
      )}

      {/* hiển thị modal xác nhận xóa khi mode được chuyển sang delete */}
      {modalConfig.mode === "delete" && (
        <ConfirmDeleteModal
          isOpen={modalConfig.isOpen}
          message={
            modalConfig.editingRecord
              ? `Are you sure you want to delete customer "${modalConfig.editingRecord.fullName}"?`
              : `Are you sure you want to delete ${selectedIds.size} selected customers?`
          }
          onClose={actions.closeModal}
          onConfirm={actions.handleConfirmDelete}
        />
      )}
    </div>
  );
}
