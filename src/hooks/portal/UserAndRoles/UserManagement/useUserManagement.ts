import { useState, useMemo } from "react";
import { toast } from "react-toastify";
import type {
  User,
  UserFormData,
} from "../../../../components/portal/UsersAndRoles/UserManagement/UserModal";

export type BulkAction = "activate" | "deactivate" | "delete";

// mock data
const INITIAL_MOCK_USERS: User[] = [
  {
    id: 1,
    name: "John Doe",
    email: "johndoe@gmail.com",
    role: "Administrator",
    status: "Active",
    lastLogin: "2 hours ago",
    selected: false,
  },
  {
    id: 2,
    name: "Sarah Smith",
    email: "sarahsmith@gmail.com",
    role: "Content Manager",
    status: "Inactive",
    lastLogin: "Yesterday",
    selected: false,
  },
  {
    id: 3,
    name: "Michael Brown",
    email: "michaelb@gmail.com",
    role: "Sale Staff",
    status: "Locked",
    lastLogin: "Dec 15, 2025",
    selected: false,
  },
  {
    id: 4,
    name: "Emily Davis",
    email: "emilyd@gmail.com",
    role: "Administrator",
    status: "Active",
    lastLogin: "5 mins ago",
    selected: false,
  },
  {
    id: 5,
    name: "David Wilson",
    email: "davidw@gmail.com",
    role: "Content Manager",
    status: "Active",
    lastLogin: "3 days ago",
    selected: false,
  },
  {
    id: 6,
    name: "Jessica Taylor",
    email: "jessicat@gmail.com",
    role: "Sale Staff",
    status: "Inactive",
    lastLogin: "Last month",
    selected: false,
  },
];

export function useUserManagement() {
  // Role: Admin
  const loggedInUserRole = "Administrator";

  // Các state chính
  const [users, setUsers] = useState<User[]>(INITIAL_MOCK_USERS);
  const [filters, setFilters] = useState({
    search: "",
    status: "Status",
    role: "Role",
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  // Các state điều khiển popup modal
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit" | "view";
    editingUser: User | null;
  }>({ isOpen: false, mode: "add", editingUser: null });

  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    type: "single" | "bulk";
    userId: number | null;
  }>({ isOpen: false, type: "single", userId: null });

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchSearch =
        user.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        user.email.toLowerCase().includes(filters.search.toLowerCase());
      const matchStatus =
        filters.status === "Status" || user.status === filters.status;
      const matchRole = filters.role === "Role" || user.role === filters.role;
      return matchSearch && matchStatus && matchRole;
    });
  }, [users, filters]);

  // Phân trang (pagination)
  const totalPages = Math.ceil(filteredUsers.length / pagination.limit);
  const startIndex = (pagination.page - 1) * pagination.limit;
  const currentUsers = filteredUsers.slice(
    startIndex,
    startIndex + pagination.limit,
  );

  // Logic xóa
  const executeDelete = () => {
    if (deleteConfig.type === "single" && deleteConfig.userId !== null) {
      setUsers(users.filter((user) => user.id !== deleteConfig.userId));
      if (currentUsers.length === 1 && pagination.page > 1) {
        setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
      }
      toast.success("Đã xóa người dùng thành công!");
    } else if (deleteConfig.type === "bulk") {
      setUsers(users.filter((user) => !user.selected));
      const remainingOnPage = currentUsers.filter((u) => !u.selected).length;
      if (remainingOnPage === 0 && pagination.page > 1) {
        setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
      }
      toast.success("Đã xóa các người dùng được chọn thành công!");
    }
    setDeleteConfig({ isOpen: false, type: "single", userId: null });
  };

  // Hàm nhận dữ liệu Modal => update lại
  const handleModalSubmit = (data: UserFormData) => {
    if (modalConfig.mode === "add") {
      const newUser: User = {
        ...data,
        id: Date.now(),
        lastLogin: "Just now",
        selected: false,
      };
      setUsers([newUser, ...users]);
      setPagination((prev) => ({ ...prev, page: 1 }));
      toast.success("Thêm người dùng mới thành công!");
    } else if (modalConfig.mode === "edit" && modalConfig.editingUser) {
      setUsers(
        users.map((u) =>
          u.id === modalConfig.editingUser!.id ? { ...u, ...data } : u,
        ),
      );
      toast.success("Cập nhật thông tin thành công!");
    }
    setModalConfig({ ...modalConfig, isOpen: false });
  };

  // Các hàm xử lý truyền vào component con để gọi khi tương tác
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
    selectUser: (id: number) =>
      setUsers(
        users.map((u) => (u.id === id ? { ...u, selected: !u.selected } : u)),
      ),
    selectAll: (isAll: boolean) =>
      setUsers(
        users.map((u) =>
          currentUsers.some((cu) => cu.id === u.id)
            ? { ...u, selected: !isAll }
            : u,
        ),
      ),
    bulk: (action: BulkAction) => {
      if (!users.some((u) => u.selected)) {
        toast.warning("Vui lòng chọn ít nhất 1 người dùng để thực hiện.");
        return;
      }
      if (action === "delete")
        return setDeleteConfig({ isOpen: true, type: "bulk", userId: null });
      setUsers(
        users.map((u) =>
          u.selected
            ? { ...u, status: action === "activate" ? "Active" : "Inactive" }
            : u,
        ),
      );
      toast.success(
        `Đã ${action === "activate" ? "kích hoạt" : "vô hiệu hóa"} các tài khoản được chọn!`,
      );
    },
    toggleStatus: (id: number, currentStatus: string) => {
      if (currentStatus === "Locked") {
        toast.warning("Tài khoản này đang bị khóa. Vui lòng mở khóa trước.");
        return;
      }
      setUsers(
        users.map((u) =>
          u.id === id
            ? {
                ...u,
                status: currentStatus === "Active" ? "Inactive" : "Active",
              }
            : u,
        ),
      );
      toast.success(
        `Đã đổi trạng thái thành ${currentStatus === "Active" ? "Inactive" : "Active"}!`,
      );
    },
    lockUnlock: (id: number, currentStatus: string) => {
      setUsers(
        users.map((u) =>
          u.id === id
            ? {
                ...u,
                status: currentStatus === "Locked" ? "Inactive" : "Locked",
              }
            : u,
        ),
      );
      toast.success(
        `Đã ${currentStatus === "Locked" ? "mở khóa" : "khóa"} tài khoản!`,
      );
    },
    deleteSingle: (id: number) =>
      setDeleteConfig({ isOpen: true, type: "single", userId: id }),
    openModal: (mode: "add" | "edit" | "view", user?: User) => {
      if (
        mode === "edit" &&
        user?.status === "Locked" &&
        loggedInUserRole !== "Administrator"
      ) {
        toast.warning(
          "Tài khoản này đang bị khóa. Chỉ có Administrator mới có quyền chỉnh sửa.",
        );
        return;
      }
      setModalConfig({ isOpen: true, mode, editingUser: user || null });
    },
  };

  return {
    currentUsers,
    filters,
    pagination,
    totalPages,
    startIndex,
    totalFiltered: filteredUsers.length,
    modalConfig,
    setModalConfig,
    deleteConfig,
    setDeleteConfig,
    actions,
    executeDelete,
    handleModalSubmit,
  };
}
