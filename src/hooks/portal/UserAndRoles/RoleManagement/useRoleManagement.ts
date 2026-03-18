import { useState } from "react";
import { toast } from "react-toastify";

// prop
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

export interface RoleFormData {
  name: string;
  status: "Active" | "Inactive";
}

// Mock data
const INITIAL_ROLES: Role[] = [
  { id: 1, name: "Admin", status: "Active", isLocked: true },
  { id: 2, name: "Manager", status: "Inactive", isLocked: false },
  { id: 3, name: "Staff", status: "Active", isLocked: false },
  { id: 4, name: "Viewer", status: "Active", isLocked: false },
];

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

export function useRoleManagement() {
  const [roles, setRoles] = useState<Role[]>(INITIAL_ROLES);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [permissions, setPermissions] =
    useState<ModulePermission[]>(INITIAL_PERMISSIONS);
  const [originalPermissions, setOriginalPermissions] =
    useState<ModulePermission[]>(INITIAL_PERMISSIONS);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    editingRole: Role | null;
  }>({ isOpen: false, mode: "add", editingRole: null });

  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    roleId: number | null;
  }>({ isOpen: false, roleId: null });

  // Xử lý gửi form modal
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

  // Khắc phục lỗi khi xóa vai trò đang được chọn
  const executeDelete = () => {
    if (deleteConfig.roleId !== null) {
      setRoles((prev) => {
        const updatedRoles = prev.filter((r) => r.id !== deleteConfig.roleId);
        // Kiểm tra vai trò hiện tại có bị xóa không, nếu có thì tự động nhảy sang vai trò còn lại
        if (selectedRoleId === deleteConfig.roleId) {
          setSelectedRoleId(null);
        }
        return updatedRoles;
      });
      toast.success("Đã xóa vai trò thành công!");
    }
    setDeleteConfig({ isOpen: false, roleId: null });
  };

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
      setSelectedRoleId(null);
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

  return {
    roles,
    permissions,
    uiState: {
      selectedRoleId,
      hasUnsavedChanges,
      searchTerm,
    },
    modalConfig,
    setModalConfig,
    deleteConfig,
    setDeleteConfig,
    actions,
    handleModalSubmit,
    executeDelete,
  };
}
