import { useState } from "react";
import RoleManagement from "../../../../components/portal/UsersAndRoles/RoleManagement/RoleManagement";
import RoleModal, {
  type RoleFormData,
} from "../../../../components/portal/UsersAndRoles/RoleManagement/RoleModal";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import "./RoleManagementPage.css";
import { toast } from "react-toastify";

//Icon
export interface Role {
  id: number;
  name: string;
  status: "Active" | "Inactive";
  isLocked: boolean;
}
export interface Permission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}
export interface ModulePermission {
  moduleId: string;
  moduleName: string;
  subModules: {
    subId: string;
    subName: string;
    permissions: Permission;
  }[];
}

// Data mock
const INITIAL_ROLES: Role[] = [
  { id: 1, name: "Admin", status: "Active", isLocked: true },
  { id: 2, name: "Manager", status: "Inactive", isLocked: false },
  { id: 3, name: "Staff", status: "Active", isLocked: false },
  { id: 4, name: "Viewer", status: "Active", isLocked: false },
];

// Data mock phân quyền
const INITIAL_PERMISSIONS: ModulePermission[] = [
  {
    moduleId: "prod",
    moduleName: "Product Management",
    subModules: [
      {
        subId: "prod_list",
        subName: "Products",
        permissions: { view: true, create: true, edit: true, delete: true },
      },
      {
        subId: "prod_attr",
        subName: "Product Attributes",
        permissions: { view: true, create: true, edit: true, delete: true },
      },
    ],
  },
  {
    moduleId: "usr",
    moduleName: "User Management",
    subModules: [
      {
        subId: "usr_list",
        subName: "User",
        permissions: { view: true, create: true, edit: true, delete: true },
      },
      {
        subId: "usr_roles",
        subName: "Roles",
        permissions: { view: true, create: true, edit: true, delete: true },
      },
    ],
  },
  {
    moduleId: "var",
    moduleName: "Variant Management",
    subModules: [
      {
        subId: "var_list",
        subName: "Variants",
        permissions: { view: true, create: true, edit: true, delete: true },
      },
    ],
  },
  {
    moduleId: "price",
    moduleName: "Price Management",
    subModules: [
      {
        subId: "price_list",
        subName: "Prices",
        permissions: { view: true, create: true, edit: true, delete: true },
      },
    ],
  },
  {
    moduleId: "tag",
    moduleName: "Tag Management",
    subModules: [
      {
        subId: "tag_list",
        subName: "Tags",
        permissions: { view: true, create: true, edit: true, delete: true },
      },
    ],
  },
];

// container bọc logic chính
export default function RoleManagementPage() {
  const [roles, setRoles] = useState<Role[]>(INITIAL_ROLES);
  const [selectedRoleId, setSelectedRoleId] = useState<number>(2);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // quản lý state phân quyền và tracking
  const [permissions, setPermissions] =
    useState<ModulePermission[]>(INITIAL_PERMISSIONS);
  const [originalPermissions, setOriginalPermissions] =
    useState<ModulePermission[]>(INITIAL_PERMISSIONS);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // state config đóng mở modal
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    editingRole: Role | null;
  }>({ isOpen: false, mode: "add", editingRole: null });

  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    roleId: number | null;
  }>({ isOpen: false, roleId: null });

  // nhóm object action truyền xuống con
  const actions = {
    changeSearch: (val: string) => setSearchTerm(val),

    selectRole: (id: number) => {
      if (hasUnsavedChanges) {
        const confirmLeave = window.confirm(
          "Bạn có thay đổi chưa lưu. Bạn có chắc muốn chuyển trang không?",
        );
        if (!confirmLeave) return;
      }
      setSelectedRoleId(id);
      setHasUnsavedChanges(false);
      // fake reset quyền khi chuyển role
      setPermissions(originalPermissions);
    },

    togglePermission: (
      moduleId: string,
      subId: string,
      action: keyof Permission,
    ) => {
      setHasUnsavedChanges(true);
      setPermissions((prev) =>
        prev.map((mod) => {
          if (mod.moduleId !== moduleId) return mod;
          return {
            ...mod,
            subModules: mod.subModules.map((sub) => {
              if (sub.subId !== subId) return sub;
              return {
                ...sub,
                permissions: {
                  ...sub.permissions,
                  [action]: !sub.permissions[action],
                },
              };
            }),
          };
        }),
      );
    },

    saveChanges: () => {
      setOriginalPermissions(permissions);
      setHasUnsavedChanges(false);
      toast.success("Đã lưu quyền thành công!");
    },

    cancelChanges: () => {
      setPermissions(originalPermissions);
      setHasUnsavedChanges(false);
    },

    openModal: (mode: "add" | "edit", role?: Role) => {
      if (mode === "edit" && role?.isLocked) {
        toast.warning("Vai trò hệ thống không được phép sửa đổi.");
        return;
      }
      setModalConfig({ isOpen: true, mode, editingRole: role || null });
    },

    deleteRole: (id: number) => {
      setDeleteConfig({ isOpen: true, roleId: id });
    },
  };

  // xử lý thao tác lưu popup thêm/sửa
  const handleModalSubmit = (data: RoleFormData) => {
    if (modalConfig.mode === "add") {
      const newRole: Role = { id: Date.now(), ...data, isLocked: false };
      setRoles((prev) => [...prev, newRole]);
      toast.success("Thêm vai trò mới thành công!");
    } else if (modalConfig.mode === "edit" && modalConfig.editingRole) {
      setRoles((prev) =>
        prev.map((r) =>
          r.id === modalConfig.editingRole!.id ? { ...r, ...data } : r,
        ),
      );
      toast.success("Cập nhật vai trò thành công!");
    }
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  // xử lý thao tác xóa
  const executeDelete = () => {
    if (deleteConfig.roleId !== null) {
      setRoles((prev) => prev.filter((r) => r.id !== deleteConfig.roleId));
      if (selectedRoleId === deleteConfig.roleId) {
        setSelectedRoleId(roles[0]?.id || 0);
      }
      toast.success("Đã xóa vai trò thành công!");
    }
    setDeleteConfig({ isOpen: false, roleId: null });
  };

  // render ui layout
  return (
    <div className="rm-page-container">
      <RoleManagement
        data={{ roles, permissions }}
        uiState={{ selectedRoleId, hasUnsavedChanges, searchTerm }}
        actions={actions}
      />

      <RoleModal
        // force reset form
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
