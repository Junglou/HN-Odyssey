import RoleManagement from "../../../../components/portal/UsersAndRoles/RoleManagement/RoleManagement";
import RoleModal from "../../../../components/portal/UsersAndRoles/RoleManagement/RoleModal";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import { useRoleManagement } from "../../../../hooks/portal/UserAndRoles/RoleManagement/useRoleManagement";
import "./RoleManagementPage.css";

export default function RoleManagementPage() {
  const {
    roles,
    permissions,
    uiState,
    modalConfig,
    setModalConfig,
    deleteConfig,
    setDeleteConfig,
    actions,
    handleModalSubmit,
    executeDelete,
  } = useRoleManagement();

  return (
    <div className="rm-page-container">
      <RoleManagement
        data={{ roles, permissions }}
        uiState={uiState}
        actions={actions}
      />

      <RoleModal
        // Key giúp unmount và remount Modal để state khởi tạo lại thay vì dùng useEffect
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
    </div>
  );
}
