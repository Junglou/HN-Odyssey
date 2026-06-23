import CustomerManagement from "../../../../components/portal/CustomerCRM/CustomerManagement/CustomerManagement";
import CustomerModal from "../../../../components/portal/CustomerCRM/CustomerManagement/CustomerModal";
import CustomerDetailModal from "../../../../components/portal/CustomerCRM/CustomerManagement/CustomerDetailModal";
import StatusReasonModal from "../../../../components/portal/CustomerCRM/CustomerManagement/StatusReasonModal";
import "./CustomerManagementPage.css";
import { useCustomerManagement } from "../../../../hooks/portal/CustomerCRM/CustomerManagement/useCustomerManagement";

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
    reasonModal,
    handleReasonSubmit,
    closeReasonModal,
  } = useCustomerManagement();

  return (
    <div className="crm-page-container">
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

      {(modalConfig.mode === "add" || modalConfig.mode === "edit") && (
        <CustomerModal
          isOpen={modalConfig.isOpen}
          mode={modalConfig.mode as "add" | "edit"}
          initialData={modalConfig.editingRecord}
          isSubmitting={modalConfig.isSubmitting}
          onClose={actions.closeModal}
          onSubmit={handleModalSubmit}
        />
      )}

      {modalConfig.mode === "view" && (
        <CustomerDetailModal
          isOpen={modalConfig.isOpen}
          customer={modalConfig.editingRecord}
          onClose={actions.closeModal}
        />
      )}

      <StatusReasonModal
        isOpen={reasonModal.isOpen}
        title={reasonModal.title}
        description={reasonModal.description}
        isSubmitting={reasonModal.isSubmitting}
        onClose={closeReasonModal}
        onSubmit={handleReasonSubmit}
      />
    </div>
  );
}
