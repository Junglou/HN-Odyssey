import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

export const STANDARD_ACTIONS = ["READ", "CREATE", "UPDATE", "DELETE"];

export interface BackendPermission {
  resource: string;
  actions: string[];
}

// Đồng bộ chuẩn schema trả về từ server, sử dụng is_active để xác định trạng thái
export interface BackendRole {
  _id: string;
  name: string;
  is_active?: boolean;
  is_system?: boolean;
  permissions?: BackendPermission[];
}

export interface BackendResourceMeta {
  code: string;
  name: string;
  availableActions: string[];
}

export interface BackendGroupMeta {
  group: string;
  resources: BackendResourceMeta[];
}

export interface Role {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  isLocked: boolean;
  permissions: BackendPermission[];
}

export interface SubModulePermission {
  subId: string;
  subName: string;
  availableActions: string[];
  grantedActions: string[];
}

export interface ModulePermission {
  moduleId: string;
  moduleName: string;
  uniqueActions: string[];
  hasOthers: boolean;
  uniqueOtherActions: string[];
  subModules: SubModulePermission[];
}

export interface RoleFormData {
  name: string;
  status: "Active" | "Inactive";
}

export function useRoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionsTemplate, setPermissionsTemplate] = useState<
    ModulePermission[]
  >([]);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [originalPermissions, setOriginalPermissions] = useState<
    ModulePermission[]
  >([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    editingRole: Role | null;
  }>({ isOpen: false, mode: "add", editingRole: null });

  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    roleId: string | null;
  }>({ isOpen: false, roleId: null });

  const fetchList = useCallback(async () => {
    try {
      const [metaRes, rolesRes] = await Promise.all([
        axiosClient.get(`/admin/roles/metadata/permissions`),
        axiosClient.get(`/admin/roles`),
      ]);

      const rawMeta: BackendGroupMeta[] = metaRes.data?.data || metaRes.data;
      const rawRolesList: BackendRole[] = rolesRes.data?.data || rolesRes.data;

      if (!Array.isArray(rawMeta) || !Array.isArray(rawRolesList)) {
        console.error("Dữ liệu trả về không phải là mảng hợp lệ!", {
          rawMeta,
          rawRolesList,
        });
        return;
      }

      const template: ModulePermission[] = rawMeta.map((grp, index) => {
        const allActions = grp.resources.flatMap((r) => r.availableActions);
        const uniqueActions = Array.from(new Set(allActions));

        const uniqueOtherActions = uniqueActions.filter(
          (a) => !STANDARD_ACTIONS.includes(a),
        );

        return {
          moduleId: `group_${index}`,
          moduleName: grp.group,
          uniqueActions,
          hasOthers: uniqueOtherActions.length > 0,
          uniqueOtherActions,
          subModules: grp.resources.map((res) => ({
            subId: res.code,
            subName: res.name,
            availableActions: res.availableActions,
            grantedActions: [],
          })),
        };
      });

      setPermissionsTemplate(template);

      const mappedRoles: Role[] = rawRolesList.map((r: BackendRole) => ({
        id: r._id,
        name: r.name,
        // Ánh xạ is_active dạng boolean của hệ thống thành status dạng chuỗi cho giao diện
        status: r.is_active === false ? "Inactive" : "Active",
        isLocked: r.is_system || false,
        permissions: r.permissions || [],
      }));

      setRoles(mappedRoles);
    } catch {
      toast.error("Không thể tải danh sách vai trò và phân quyền.");
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const loadInit = async () => {
      await fetchList();
      if (!ignore) {
        setSelectedRoleId(null);
        setPermissions([]);
        setOriginalPermissions([]);
        setHasUnsavedChanges(false);
        setSearchTerm("");
        setModalConfig({ isOpen: false, mode: "add", editingRole: null });
        setDeleteConfig({ isOpen: false, roleId: null });
      }
    };
    void loadInit();
    return () => {
      ignore = true;
    };
  }, [fetchList]);

  const handleModalSubmit = async (data: RoleFormData) => {
    try {
      const payload = {
        name: data.name,
        is_active: data.status === "Active",
        permissions: modalConfig.mode === "add" ? [] : undefined,
      };

      if (modalConfig.mode === "add") {
        await axiosClient.post(`/admin/roles`, payload);
        toast.success("Thêm vai trò mới thành công!");
      } else if (modalConfig.mode === "edit" && modalConfig.editingRole) {
        await axiosClient.patch(
          `/admin/roles/${modalConfig.editingRole.id}`,
          payload,
        );
        toast.success("Cập nhật vai trò thành công!");
      }

      setModalConfig((prev) => ({ ...prev, isOpen: false }));
      void fetchList();
    } catch {
      toast.error("Không thể lưu vai trò. Tên vai trò có thể đã tồn tại.");
    }
  };

  const executeDelete = async () => {
    if (deleteConfig.roleId !== null) {
      try {
        await axiosClient.delete(`/admin/roles/${deleteConfig.roleId}`);
        if (selectedRoleId === deleteConfig.roleId) {
          setSelectedRoleId(null);
        }
        toast.success("Đã xóa vai trò thành công!");
        void fetchList();
      } catch {
        toast.warning("Vai trò này đang được áp dụng, không thể xóa.");
      }
    }
    setDeleteConfig({ isOpen: false, roleId: null });
  };

  const actions = {
    changeSearch: (val: string) => setSearchTerm(val),

    selectRole: (id: string) => {
      if (hasUnsavedChanges) {
        const confirmLeave = window.confirm(
          "Bạn có thay đổi chưa lưu. Bạn có chắc muốn chuyển trang không?",
        );
        if (!confirmLeave) return;
      }

      setSelectedRoleId(id);
      setHasUnsavedChanges(false);

      const selected = roles.find((r) => r.id === id);
      const userPerms = selected?.permissions || [];

      const mappedPermissions = permissionsTemplate.map((mod) => ({
        ...mod,
        subModules: mod.subModules.map((sub) => {
          const bePerm = userPerms.find((p) => p.resource === sub.subId);

          let granted: string[] = [];
          if (bePerm) {
            if (bePerm.actions.includes("MANAGE")) {
              granted = [...sub.availableActions];
            } else {
              granted = bePerm.actions;
            }
          }

          return {
            ...sub,
            grantedActions: granted,
          };
        }),
      }));

      setPermissions(JSON.parse(JSON.stringify(mappedPermissions)));
      setOriginalPermissions(JSON.parse(JSON.stringify(mappedPermissions)));
    },

    togglePermission: (moduleId: string, subId: string, action: string) => {
      setHasUnsavedChanges(true);
      setPermissions((prev) =>
        prev.map((mod) => {
          if (mod.moduleId !== moduleId) return mod;
          return {
            ...mod,
            subModules: mod.subModules.map((sub) => {
              if (sub.subId !== subId) return sub;

              const isGranted = sub.grantedActions.includes(action);
              const newActions = isGranted
                ? sub.grantedActions.filter((a) => a !== action)
                : [...sub.grantedActions, action];

              return { ...sub, grantedActions: newActions };
            }),
          };
        }),
      );
    },

    saveChanges: async () => {
      if (!selectedRoleId) return;

      try {
        const bePermissionsPayload: BackendPermission[] = [];

        permissions.forEach((mod) => {
          mod.subModules.forEach((sub) => {
            if (sub.grantedActions.length > 0) {
              let actionsToSave = sub.grantedActions;
              if (
                sub.availableActions.length > 0 &&
                sub.grantedActions.length === sub.availableActions.length
              ) {
                actionsToSave = ["MANAGE"];
              }

              bePermissionsPayload.push({
                resource: sub.subId,
                actions: actionsToSave,
              });
            }
          });
        });

        await axiosClient.patch(`/admin/roles/${selectedRoleId}`, {
          permissions: bePermissionsPayload,
        });

        setOriginalPermissions(permissions);
        setHasUnsavedChanges(false);
        toast.success("Đã lưu phân quyền thành công!");
        void fetchList();
      } catch {
        toast.error("Không thể cập nhật cấu hình phân quyền.");
      }
    },

    cancelChanges: () => {
      setPermissions(JSON.parse(JSON.stringify(originalPermissions)));
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

    deleteRole: (id: string) => {
      setDeleteConfig({ isOpen: true, roleId: id });
    },
  };

  return {
    roles,
    permissions,
    uiState: { selectedRoleId, hasUnsavedChanges, searchTerm },
    modalConfig,
    setModalConfig,
    deleteConfig,
    setDeleteConfig,
    actions,
    handleModalSubmit,
    executeDelete,
  };
}
