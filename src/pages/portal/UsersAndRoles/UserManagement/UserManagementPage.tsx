import UserManagement from "../../../../components/portal/UsersAndRoles/UserManagement/UserManagement";
import UserModal from "../../../../components/portal/UsersAndRoles/UserManagement/UserModal";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import { useUserManagement } from "../../../../hooks/portal/UserAndRoles/UserManagement/useUserManagement";
import "./UserManagementPage.css";

export default function UserManagementPage() {
  const {
    currentUsers,
    filters,
    pagination,
    totalPages,
    startIndex,
    totalFiltered,
    modalConfig,
    setModalConfig,
    deleteConfig,
    setDeleteConfig,
    actions,
    executeDelete,
    handleModalSubmit,
  } = useUserManagement();

  return (
    <div className="um-page-container">
      <UserManagement
        data={currentUsers}
        filters={filters}
        pagination={{
          page: pagination.page,
          limit: pagination.limit,
          totalPages,
          startIndex,
          endIndex: startIndex + pagination.limit,
          totalFiltered,
        }}
        actions={actions}
      />

      <UserModal
        key={
          modalConfig.isOpen
            ? `${modalConfig.mode}-${modalConfig.editingUser?.id || "new"}`
            : "closed"
        }
        isOpen={modalConfig.isOpen}
        mode={modalConfig.mode}
        initialData={modalConfig.editingUser}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onSubmit={handleModalSubmit}
      />

      <ConfirmDeleteModal
        isOpen={deleteConfig.isOpen}
        message={
          deleteConfig.type === "single"
            ? "Are you sure you want to delete this user?"
            : "Are you sure you want to delete the selected users?"
        }
        onClose={() =>
          setDeleteConfig({ isOpen: false, type: "single", userId: null })
        }
        onConfirm={executeDelete}
      />
    </div>
  );
}
