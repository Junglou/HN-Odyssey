import { useState, useRef, useMemo } from "react";
import { toast } from "react-toastify";

// prop and types
export type CustomerStatus = "Active" | "Inactive" | "Locked";
export type CustomerType =
  | "Standard"
  | "Trade-in Customer"
  | "Silver"
  | "Gold"
  | "VIP";

export interface CustomerRecord {
  id: string;
  fullName: string;
  email: string;
  username: string;
  customerType: CustomerType;
  status: CustomerStatus;
  lastLogin: string;
  phone: string;
}

export interface CustomerFormData {
  fullName: string;
  email: string;
  username: string;
  password?: string;
  customerType: CustomerType;
  phone: string;
  status: CustomerStatus;
}

// mock data
const INITIAL_CUSTOMERS: CustomerRecord[] = [
  {
    id: "1",
    fullName: "John Doe",
    email: "johndoe@gmail.com",
    username: "johndoe",
    customerType: "Standard",
    status: "Active",
    lastLogin: "2 hours ago",
    phone: "+84 123 456 789",
  },
  {
    id: "2",
    fullName: "Sarah Smith",
    email: "sarahsmith@gmail.com",
    username: "sarahs",
    customerType: "Trade-in Customer",
    status: "Inactive",
    lastLogin: "Yesterday",
    phone: "+84 987 654 321",
  },
  {
    id: "3",
    fullName: "Michael Brown",
    email: "michaelb@gmail.com",
    username: "mikeb",
    customerType: "Silver",
    status: "Locked",
    lastLogin: "Dec 15, 2025",
    phone: "+84 555 666 777",
  },
  {
    id: "4",
    fullName: "Emily White",
    email: "emilyw@gmail.com",
    username: "emilyw",
    customerType: "Gold",
    status: "Active",
    lastLogin: "2 hours ago",
    phone: "+84 111 222 333",
  },
  {
    id: "5",
    fullName: "David Clark",
    email: "davidc@gmail.com",
    username: "davidc",
    customerType: "VIP",
    status: "Inactive",
    lastLogin: "Yesterday",
    phone: "+84 333 444 555",
  },
];

export function useCustomerManagement() {
  const [records, setRecords] = useState<CustomerRecord[]>(INITIAL_CUSTOMERS);
  const nextIdCounter = useRef<number>(6);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "All">(
    "All",
  );
  const [typeFilter, setTypeFilter] = useState<CustomerType | "All">("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  // quản lý đóng mở modal
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit" | "view" | "delete";
    editingRecord: CustomerRecord | null;
    isSubmitting: boolean;
  }>({ isOpen: false, mode: "add", editingRecord: null, isSubmitting: false });

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchStatus =
        statusFilter === "All" || record.status === statusFilter;
      const matchType =
        typeFilter === "All" || record.customerType === typeFilter;
      const matchSearch =
        !normalizedSearch ||
        record.fullName.toLowerCase().includes(normalizedSearch) ||
        record.email.toLowerCase().includes(normalizedSearch) ||
        record.username.toLowerCase().includes(normalizedSearch);

      return matchStatus && matchType && matchSearch;
    });
  }, [records, search, statusFilter, typeFilter]);

  const totalPages = Math.ceil(filteredRecords.length / pagination.limit);
  const startIndex = (pagination.page - 1) * pagination.limit;
  const currentRecords = filteredRecords.slice(
    startIndex,
    startIndex + pagination.limit,
  );

  const actions = {
    changeSearch: (val: string) => {
      setSearch(val);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changeStatusFilter: (status: CustomerStatus | "All") => {
      setStatusFilter(status);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changeTypeFilter: (type: CustomerType | "All") => {
      setTypeFilter(type);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    clearFilters: () => {
      setSearch("");
      setStatusFilter("All");
      setTypeFilter("All");
      setPagination((p) => ({ ...p, page: 1 }));
    },

    toggleSelection: (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },

    toggleSelectAll: (isSelectAll: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentRecords.forEach((r) => {
          if (isSelectAll) next.add(r.id);
          else next.delete(r.id);
        });
        return next;
      });
    },

    changePage: (page: number) => setPagination((p) => ({ ...p, page })),
    changeLimit: (limit: number) => setPagination({ page: 1, limit }),
    openAddModal: () =>
      setModalConfig({
        isOpen: true,
        mode: "add",
        editingRecord: null,
        isSubmitting: false,
      }),
    openEditModal: (record: CustomerRecord) =>
      setModalConfig({
        isOpen: true,
        mode: "edit",
        editingRecord: record,
        isSubmitting: false,
      }),
    openViewModal: (record: CustomerRecord) =>
      setModalConfig({
        isOpen: true,
        mode: "view",
        editingRecord: record,
        isSubmitting: false,
      }),
    openDeleteModal: (record?: CustomerRecord) => {
      setModalConfig({
        isOpen: true,
        mode: "delete",
        editingRecord: record || null,
        isSubmitting: false,
      });
    },

    closeModal: () =>
      setModalConfig({
        isOpen: false,
        mode: "add",
        editingRecord: null,
        isSubmitting: false,
      }),

    // xác nhận xóa
    handleConfirmDelete: () => {
      if (modalConfig.editingRecord) {
        const id = modalConfig.editingRecord.id;
        setRecords((prev) => prev.filter((r) => r.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.success("Đã xóa khách hàng thành công!");
      } else {
        const deletedCount = selectedIds.size;
        setRecords((prev) => prev.filter((r) => !selectedIds.has(r.id)));
        toast.success(`Đã xóa ${deletedCount} khách hàng thành công!`);
        setSelectedIds(new Set());
      }
      setModalConfig((prev) => ({ ...prev, isOpen: false }));
    },
    lockUnlockCustomer: (id: string, currentStatus: CustomerStatus) => {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: currentStatus === "Locked" ? "Inactive" : "Locked",
              }
            : r,
        ),
      );
      toast.success(
        `Đã ${currentStatus === "Locked" ? "mở khóa" : "khóa"} tài khoản!`,
      );
    },
  };

  const toggleRowStatus = (id: string, currentStatus: CustomerStatus) => {
    if (currentStatus === "Locked") {
      toast.warning("Tài khoản đang bị khóa, không thể thay đổi trạng thái!");
      return;
    }
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: currentStatus === "Active" ? "Inactive" : "Active" }
          : r,
      ),
    );
    toast.success("Đã thay đổi trạng thái khách hàng!");
  };

  const handleModalSubmit = (data: CustomerFormData) => {
    const { mode, editingRecord } = modalConfig;

    if (!data.fullName.trim() || !data.email.trim() || !data.username.trim()) {
      toast.error("Vui lòng điền đầy đủ các thông tin bắt buộc.");
      return;
    }

    setModalConfig((prev) => ({ ...prev, isSubmitting: true }));

    try {
      if (mode === "add") {
        const newRecord: CustomerRecord = {
          id: nextIdCounter.current.toString(),
          fullName: data.fullName.trim(),
          email: data.email.trim(),
          username: data.username.trim(),
          customerType: data.customerType,
          status: data.status,
          lastLogin: "Never",
          phone: data.phone.trim(),
        };
        nextIdCounter.current += 1;
        setRecords((prev) => [newRecord, ...prev]);
        setPagination((p) => ({ ...p, page: 1 }));
        toast.success("Thêm khách hàng thành công!");
      } else if (mode === "edit" && editingRecord) {
        setRecords((prev) =>
          prev.map((r) =>
            r.id === editingRecord.id
              ? {
                  ...r,
                  fullName: data.fullName.trim(),
                  email: data.email.trim(),
                  username: data.username.trim(),
                  phone: data.phone.trim(),
                  customerType: data.customerType,
                  status: data.status,
                }
              : r,
          ),
        );
        toast.success("Cập nhật thông tin thành công!");
      }
      actions.closeModal();
    } catch {
      toast.error("Đã xảy ra lỗi trong quá trình lưu dữ liệu.");
      setModalConfig((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // nút bulk
  const bulkActions = {
    bulkActivate: () => {
      // bỏ qua các bản ghi đang bị khóa
      const targets = records.filter(
        (r) => selectedIds.has(r.id) && r.status !== "Locked",
      );
      if (targets.length === 0) return;

      setRecords((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id) && r.status !== "Locked"
            ? { ...r, status: "Active" }
            : r,
        ),
      );
      toast.success(`Đã kích hoạt ${targets.length} khách hàng!`);
      setSelectedIds(new Set());
    },

    bulkDeactivate: () => {
      const targets = records.filter(
        (r) => selectedIds.has(r.id) && r.status !== "Locked",
      );
      if (targets.length === 0) return;

      setRecords((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id) && r.status !== "Locked"
            ? { ...r, status: "Inactive" }
            : r,
        ),
      );
      toast.warning(`Đã vô hiệu hóa ${targets.length} khách hàng!`);
      setSelectedIds(new Set());
    },

    bulkDelete: () => {
      if (selectedIds.size === 0) return;
      actions.openDeleteModal();
    },
  };

  return {
    currentRecords,
    pagination: {
      ...pagination,
      totalPages,
      totalFiltered: filteredRecords.length,
      startIndex,
    },
    search,
    statusFilter,
    typeFilter,
    selectedIds,
    modalConfig,
    actions,
    toggleRowStatus,
    handleModalSubmit,
    bulkActions,
  };
}
