import RoleManagement from "../../../../components/portal/UsersAndRoles/RoleManagement/RoleManagement";
import RoleModal from "../../../../components/portal/UsersAndRoles/RoleManagement/RoleModal";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import { useRoleManagement } from "../../../../hooks/portal/UserAndRoles/RoleManagement/useRoleManagement";
import "./RoleManagementPage.css";

export default function RoleManagementPage() {
  const {
    roles,
    isLoading,
    permissions,
    uiState,
    modalConfig,
    setModalConfig,
    deleteConfig,
    setDeleteConfig,
    actions,
    handleModalSubmit,
    executeDelete,
    pendingRoleId,
  } = useRoleManagement();

  return (
    <div className="rm-page-container">
      <RoleManagement
        data={{ roles, permissions }}
        isLoading={isLoading}
        uiState={uiState}
        actions={actions}
      />

      <RoleModal
        key={
          modalConfig.isOpen
            ? `${modalConfig.mode}-${modalConfig.editingRole?.id || "new"}`
            : "closed"
        }
        isOpen={modalConfig.isOpen}
        mode={modalConfig.mode}
        initialData={modalConfig.editingRole}
        onClose={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
        onSubmit={handleModalSubmit}
      />

      <ConfirmDeleteModal
        isOpen={deleteConfig.isOpen}
        message="Are you sure you want to delete this role?"
        onClose={() => setDeleteConfig({ isOpen: false, roleId: null })}
        onConfirm={executeDelete}
      />

      <ConfirmDeleteModal
        isOpen={pendingRoleId !== null}
        title="Unsaved Changes"
        message="You have unsaved permission changes. Switch to another role and discard them?"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onClose={actions.cancelLeaveRole}
        onConfirm={actions.confirmLeaveRole}
      />
    </div>
  );
}
