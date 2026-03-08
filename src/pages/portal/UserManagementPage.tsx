import { useState, useMemo } from "react";
import UserManagement from "../../components/portal/UserManagement/UserManagement";
import UserModal, {
  type User,
  type UserFormData,
} from "../../components/portal/UserManagement/UserModal";
import "./UserManagementPage.css";

// Dữ liệu mẫu
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

const UserManagementPage = () => {
  // MOCK DATA BACKEND: Giả lập người đang đăng nhập hiện tại là Administrator
  // Sau này thay bằng state lấy từ Redux/Context (vd: const { role } = useAuth())
  const loggedInUserRole = "Administrator";

  // Các state quản lý dữ liệu và bộ lọc
  const [users, setUsers] = useState<User[]>(INITIAL_MOCK_USERS);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("Status");
  const [roleFilter, setRoleFilter] = useState<string>("Role");

  // State cho phân trang
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // State quản lý Modal
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit" | "view";
    editingUser: User | null;
  }>({
    isOpen: false,
    mode: "add",
    editingUser: null,
  });

  // Logic lọc dữ liệu tổng
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "Status" || user.status === statusFilter;
      const matchesRole = roleFilter === "Role" || user.role === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [users, searchTerm, statusFilter, roleFilter]);

  // Logic phân trang
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // Các Handlers thao tác dữ liệu
  const handleClearFilter = () => {
    setSearchTerm("");
    setStatusFilter("Status");
    setRoleFilter("Role");
    setCurrentPage(1);
  };

  const handleSelectUser = (id: number) => {
    setUsers(
      users.map((user) =>
        user.id === id ? { ...user, selected: !user.selected } : user,
      ),
    );
  };

  const handleSelectAll = (isAllSelected: boolean) => {
    const newSelectedStatus = !isAllSelected;
    setUsers(
      users.map((user) =>
        currentUsers.some((cUser) => cUser.id === user.id)
          ? { ...user, selected: newSelectedStatus }
          : user,
      ),
    );
  };

  const handleBulkActivate = () =>
    setUsers(
      users.map((user) =>
        user.selected ? { ...user, status: "Active" } : user,
      ),
    );
  const handleBulkDeactivate = () =>
    setUsers(
      users.map((user) =>
        user.selected ? { ...user, status: "Inactive" } : user,
      ),
    );
  const handleBulkDelete = () => {
    if (window.confirm("Are you sure you want to delete selected users?")) {
      setUsers(users.filter((user) => !user.selected));
    }
  };

  const handleToggleStatus = (id: number, currentStatus: string) => {
    if (currentStatus === "Locked") {
      alert("This account is locked. Please unlock it first.");
      return;
    }
    setUsers(
      users.map((user) =>
        user.id === id
          ? {
              ...user,
              status: user.status === "Active" ? "Inactive" : "Active",
            }
          : user,
      ),
    );
  };

  const handleLockUnlock = (id: number, currentStatus: string) => {
    setUsers(
      users.map((user) =>
        user.id === id
          ? {
              ...user,
              status: currentStatus === "Locked" ? "Inactive" : "Locked",
            }
          : user,
      ),
    );
  };

  const handleDeleteSingle = (id: number) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      setUsers(users.filter((user) => user.id !== id));
      if (currentUsers.length === 1 && currentPage > 1)
        setCurrentPage(currentPage - 1);
    }
  };

  const handleModalSubmit = (data: UserFormData) => {
    if (modalConfig.mode === "add") {
      const newUser: User = {
        ...data,
        id: Date.now(),
        lastLogin: "Just now",
        selected: false,
      };
      setUsers([newUser, ...users]);
      setCurrentPage(1);
    } else if (modalConfig.mode === "edit" && modalConfig.editingUser) {
      setUsers(
        users.map((u) =>
          u.id === modalConfig.editingUser!.id ? { ...u, ...data } : u,
        ),
      );
    }
    setModalConfig({ ...modalConfig, isOpen: false });
  };

  return (
    <div className="um-page-container">
      <UserManagement
        currentUsers={currentUsers}
        totalFiltered={filteredUsers.length}
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        roleFilter={roleFilter}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        totalPages={totalPages}
        startIndex={startIndex}
        endIndex={endIndex}
        onSearchChange={(val) => {
          setSearchTerm(val);
          setCurrentPage(1);
        }}
        onStatusChange={(val) => {
          setStatusFilter(val);
          setCurrentPage(1);
        }}
        onRoleChange={(val) => {
          setRoleFilter(val);
          setCurrentPage(1);
        }}
        onClearFilter={handleClearFilter}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(val) => {
          setItemsPerPage(val);
          setCurrentPage(1);
        }}
        onSelectUser={handleSelectUser}
        onSelectAll={handleSelectAll}
        onBulkActivate={handleBulkActivate}
        onBulkDeactivate={handleBulkDeactivate}
        onBulkDelete={handleBulkDelete}
        onToggleStatus={handleToggleStatus}
        onLockUnlock={handleLockUnlock}
        onDeleteSingle={handleDeleteSingle}
        onOpenModal={(mode, user) => {
          // LOGIC PHÂN QUYỀN MỚI THEO YÊU CẦU:
          // Nếu tài khoản bị Khóa, VÀ hành động là Sửa, VÀ người dùng hiện tại KHÔNG PHẢI Admin -> Chặn lại.
          if (
            mode === "edit" &&
            user?.status === "Locked" &&
            loggedInUserRole !== "Administrator"
          ) {
            alert(
              "Tài khoản này đang bị khóa. Chỉ có Administrator mới có quyền chỉnh sửa.",
            );
            return;
          }
          setModalConfig({ isOpen: true, mode, editingUser: user || null });
        }}
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
    </div>
  );
};

export default UserManagementPage;
