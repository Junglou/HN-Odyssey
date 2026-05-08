import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import type { UserFormData } from "../../../../components/portal/UsersAndRoles/UserManagement/UserModal";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("accessToken");
  return {
    headers: { Authorization: `Bearer ${token}` },
  };
};

export type BulkAction = "activate" | "deactivate" | "delete";

export interface BackendUser {
  _id: string;
  email: string;
  first_Name: string;
  last_Name: string;
  phone?: string;
  roles: string[];
  status: string;
  last_login_at?: string;
  department?: string;
  employee_code?: string;
}

export interface BackendRole {
  _id: string;
  name: string;
  slug: string;
}

export interface BackendDepartment {
  label: string;
  value: string;
}

export interface DropdownOption {
  label: string;
  value: string;
}

export const STATUS_OPTIONS: DropdownOption[] = [
  { label: "All Status", value: "Status" },
  { label: "Active", value: "ACTIVE" },
  { label: "Locked / Suspended", value: "SUSPENDED" },
  { label: "Terminated / Deleted", value: "TERMINATED" },
];

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  status: string;
  lastLogin: string;
  selected: boolean;
}

const formatLastLogin = (dateString?: string) => {
  if (!dateString) return "Chưa đăng nhập";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  // Định dạng linh hoạt theo thời gian thực (giống Facebook/Google)
  if (diffMins < 2) return "Vừa mới đây";
  if (diffMins < 60) return `${diffMins} phút trước`;

  // Nếu là cùng ngày hôm nay
  if (diffHours < 24 && now.getDate() === date.getDate()) {
    return `Hôm nay, ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
  }

  // Nếu là hôm qua
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth()
  ) {
    return `Hôm qua, ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
  }

  // Cũ hơn thì hiện ngày tháng gọn gàng (VD: 08/05/2026)
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export function useUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [roleOptions, setRoleOptions] = useState<DropdownOption[]>([
    { label: "All Roles", value: "Role" },
  ]);
  const [departmentOptions, setDepartmentOptions] = useState<DropdownOption[]>(
    [],
  );

  const [filters, setFilters] = useState({
    search: "",
    status: "Status",
    role: "Role",
  });

  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [totalPages, setTotalPages] = useState(1);
  const [totalFiltered, setTotalFiltered] = useState(0);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit" | "view";
    editingUser: User | null;
  }>({ isOpen: false, mode: "add", editingUser: null });

  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    type: "single" | "bulk";
    userId: string | null;
  }>({ isOpen: false, type: "single", userId: null });

  const fetchMetadata = useCallback(async () => {
    try {
      const [rolesRes, deptsRes] = await Promise.all([
        axios.get(`${API_URL}/admin/roles`, getAuthHeaders()),
        axios.get(
          `${API_URL}/admin/users/staff/metadata/departments`,
          getAuthHeaders(),
        ),
      ]);

      const rawRoles: BackendRole[] = rolesRes.data?.data || rolesRes.data;
      if (Array.isArray(rawRoles)) {
        const dynamicRoles = rawRoles.map((r) => ({
          label: r.name,
          value: r.slug,
        }));
        setRoleOptions([
          { label: "All Roles", value: "Role" },
          ...dynamicRoles,
        ]);
      }

      const rawDepts = deptsRes.data?.data || deptsRes.data;
      if (Array.isArray(rawDepts)) {
        const dynamicDepts = rawDepts.map((d: BackendDepartment) => ({
          label: d.label,
          value: d.value,
        }));
        setDepartmentOptions(dynamicDepts);
      }
    } catch (error) {
      console.error("Không thể tải Metadata (Roles/Departments)", error);
    }
  }, []);

  const fetchList = useCallback(async () => {
    try {
      const params: Record<string, string | number> = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (filters.search) params.search = filters.search;
      if (filters.status && filters.status !== "Status")
        params.status = filters.status;
      if (filters.role && filters.role !== "Role") params.role = filters.role;

      const res = await axios.get(`${API_URL}/admin/users/staff`, {
        ...getAuthHeaders(),
        params,
      });

      const rawData: BackendUser[] = res.data?.data || [];
      const rawMeta = res.data?.meta || {};

      const mappedUsers: User[] = rawData.map((u) => ({
        id: u._id,
        name: `${u.last_Name} ${u.first_Name}`.trim(),
        email: u.email,
        phone: u.phone || "",
        department: u.department || "",
        role: u.roles && u.roles.length > 0 ? u.roles[0] : "No Role",
        status:
          u.status === "ACTIVE"
            ? "Active"
            : u.status === "SUSPENDED"
              ? "Locked"
              : "Inactive",
        lastLogin: formatLastLogin(u.last_login_at),
        selected: false,
      }));

      setUsers(mappedUsers);
      setTotalPages(rawMeta.total_pages || 1);
      setTotalFiltered(rawMeta.total_docs || 0);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errorMsg =
          (error.response?.data as { message?: string })?.message ||
          "Lỗi xảy ra";
        toast.error(errorMsg);
      }
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    let ignore = false;
    const initData = async () => {
      await fetchMetadata();
      await fetchList();
      if (!ignore) {
        // Không cần setState ở đây vì fetchList đã cập nhật state users, totalPages, totalFiltered
      }
    };
    void initData();
    return () => {
      ignore = true;
    };
  }, [fetchMetadata, fetchList]);

  // XÓA (SINGLE / BULK)
  const executeDelete = async () => {
    if (deleteConfig.type === "single" && deleteConfig.userId !== null) {
      try {
        const res = await axios.delete(
          `${API_URL}/admin/users/staff/${deleteConfig.userId}`,
          getAuthHeaders(),
        );
        if (res?.data)
          toast.success(res.data.message || "Đã xóa nhân viên thành công!");
        void fetchList();
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          const errorMsg =
            (error.response?.data as { message?: string })?.message ||
            "Lỗi xảy ra";
          toast.error(errorMsg);
        }
      }
    } else if (deleteConfig.type === "bulk") {
      try {
        const selectedIds = users.filter((u) => u.selected).map((u) => u.id);

        const res = await axios.post(
          `${API_URL}/admin/users/staff/bulk/delete`,
          { userIds: selectedIds },
          getAuthHeaders(),
        );

        if (res?.data)
          toast.success(
            res.data.message || "Đã xóa các nhân viên được chọn thành công!",
          );
        void fetchList();
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          const errorMsg =
            (error.response?.data as { message?: string })?.message ||
            "Lỗi khi xóa hàng loạt";
          toast.error(errorMsg);
        }
      }
    }
    setDeleteConfig({ isOpen: false, type: "single", userId: null });
  };

  const handleModalSubmit = async (data: UserFormData) => {
    try {
      const nameParts = data.name.trim().split(" ");
      const firstName =
        nameParts.length > 1 ? nameParts[nameParts.length - 1] : data.name;
      const lastName =
        nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : data.name;

      if (modalConfig.mode === "add") {
        const payload = {
          email: data.email,
          lastName,
          firstName,
          phone: data.phone,
          password: data.password,
          roles: [data.role],
          department: data.department,
        };
        const res = await axios.post(
          `${API_URL}/admin/users/staff`,
          payload,
          getAuthHeaders(),
        );
        if (res)
          toast.success(res.data?.message || "Thêm nhân viên mới thành công!");
      } else if (modalConfig.mode === "edit" && modalConfig.editingUser) {
        const payload: Record<string, unknown> = {
          email: data.email,
          lastName,
          firstName,
          phone: data.phone,
          roles: [data.role],
          department: data.department,
          is_active: data.status === "Active",
        };
        if (
          data.password &&
          data.password !== "••••••••" &&
          data.password.length >= 8
        ) {
          payload.password = data.password;
        }

        const res = await axios.patch(
          `${API_URL}/admin/users/staff/${modalConfig.editingUser.id}`,
          payload,
          getAuthHeaders(),
        );
        if (res)
          toast.success(res.data?.message || "Cập nhật thông tin thành công!");
      }

      setModalConfig((prev) => ({ ...prev, isOpen: false }));
      void fetchList();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errorMsg =
          (error.response?.data as { message?: string })?.message ||
          "Lỗi khi lưu dữ liệu!";
        toast.error(errorMsg);
      }
    }
  };

  const actions = {
    changeFilter: (key: keyof typeof filters, val: string) => {
      setFilters((prev) => ({ ...prev, [key]: val }));
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    clearFilter: () => {
      setFilters({ search: "", status: "Status", role: "Role" });
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    changePage: (page: number) => setPagination((prev) => ({ ...prev, page })),
    changeLimit: (limit: number) => setPagination({ page: 1, limit }),

    selectUser: (id: string) =>
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, selected: !u.selected } : u)),
      ),
    selectAll: (isAll: boolean) =>
      setUsers((prev) => prev.map((u) => ({ ...u, selected: !isAll }))),

    bulk: async (action: BulkAction) => {
      const selectedIds = users.filter((u) => u.selected).map((u) => u.id);
      if (selectedIds.length === 0) {
        toast.warning("Vui lòng chọn ít nhất 1 người dùng để thực hiện.");
        return;
      }
      if (action === "delete") {
        setDeleteConfig({ isOpen: true, type: "bulk", userId: null });
        return;
      }

      try {
        const is_active = action === "activate";
        const res = await axios.patch(
          `${API_URL}/admin/users/staff/bulk/status`,
          { userIds: selectedIds, is_active },
          getAuthHeaders(),
        );
        if (res)
          toast.success(
            res.data?.message ||
              `Đã ${is_active ? "kích hoạt" : "khóa"} tài khoản hàng loạt!`,
          );
        void fetchList();
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          const errorMsg =
            (error.response?.data as { message?: string })?.message ||
            "Lỗi đổi trạng thái";
          toast.error(errorMsg);
        }
      }
    },

    toggleStatus: async (id: string, currentStatus: string) => {
      if (currentStatus === "Inactive") return;
      try {
        const newStatus = currentStatus === "Active" ? "SUSPENDED" : "ACTIVE";
        const res = await axios.patch(
          `${API_URL}/admin/users/staff/${id}/status`,
          { status: newStatus, reason: "Cập nhật từ Portal" },
          getAuthHeaders(),
        );
        if (res)
          toast.success(res.data?.message || "Đã đổi trạng thái thành công!");
        void fetchList();
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          const errorMsg =
            (error.response?.data as { message?: string })?.message ||
            "Lỗi xảy ra";
          toast.error(errorMsg);
        }
      }
    },

    lockUnlock: (id: string, currentStatus: string) => {
      actions.toggleStatus(id, currentStatus);
    },

    deleteSingle: (id: string) =>
      setDeleteConfig({ isOpen: true, type: "single", userId: id }),

    openModal: (mode: "add" | "edit" | "view", user?: User) => {
      setModalConfig({ isOpen: true, mode, editingUser: user || null });
    },
  };

  return {
    currentUsers: users,
    filters,
    pagination,
    totalPages,
    startIndex: (pagination.page - 1) * pagination.limit,
    totalFiltered,
    roleOptions,
    STATUS_OPTIONS,
    departmentOptions,
    modalConfig,
    setModalConfig,
    deleteConfig,
    setDeleteConfig,
    actions,
    executeDelete,
    handleModalSubmit,
  };
}
