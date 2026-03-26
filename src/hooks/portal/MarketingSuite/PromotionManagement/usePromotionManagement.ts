import { useState, useRef, useMemo } from "react";
import { toast } from "react-toastify";

// prop and types
export type PromotionStatus =
  | "Active"
  | "Inactive"
  | "Scheduled"
  | "Expired"
  | "Draft";
export type PromotionType = "Flash Sale" | "Discount";
export type DiscountType = "%" | "Fixed";
export type ApplicableScope = "Product" | "Category" | "Tag";

export interface PromotionRecord {
  id: string;
  name: string;
  type: PromotionType;
  discountValue: string;
  applicableScopeType: ApplicableScope;
  applicableScopeValues: string[];
  status: PromotionStatus;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface PromotionFormData {
  name: string;
  type: PromotionType;
  discountValueNum: string;
  discountType: DiscountType;
  applicableScopeType: ApplicableScope;
  applicableScopeValues: string[];
  status: PromotionStatus;
  startDate: string;
  endDate: string;
  description: string;
}

// mock data
const INITIAL_PROMOTIONS: PromotionRecord[] = [
  {
    id: "1",
    name: "Summer Sale 2024",
    type: "Flash Sale",
    discountValue: "25% OFF",
    applicableScopeType: "Category",
    applicableScopeValues: ["Summer Collection"],
    status: "Active",
    startDate: "2024-06-01",
    endDate: "2024-07-31",
  },
  {
    id: "2",
    name: "New User Discount",
    type: "Discount",
    discountValue: "$10 Fixed",
    applicableScopeType: "Tag",
    applicableScopeValues: ["New Arrival"],
    status: "Active",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
  },
  {
    id: "3",
    name: "Black Friday Preview",
    type: "Flash Sale",
    discountValue: "40% OFF",
    applicableScopeType: "Product",
    applicableScopeValues: ["Selected Items"],
    status: "Scheduled",
    startDate: "2024-11-15",
    endDate: "2024-11-17",
  },
  {
    id: "4",
    name: "Spring Clearance",
    type: "Discount",
    discountValue: "50% OFF",
    applicableScopeType: "Category",
    applicableScopeValues: ["Winter Clearance"],
    status: "Expired",
    startDate: "2024-03-01",
    endDate: "2024-04-30",
  },
  {
    id: "5",
    name: "Back to School",
    type: "Discount",
    discountValue: "15% OFF",
    applicableScopeType: "Tag",
    applicableScopeValues: ["School Supplies"],
    status: "Draft",
    startDate: "2024-08-01",
    endDate: "2024-09-15",
  },
];

export function usePromotionManagement() {
  const [records, setRecords] = useState<PromotionRecord[]>(INITIAL_PROMOTIONS);
  const nextIdCounter = useRef<number>(6);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<PromotionStatus | "All">(
    "All",
  );
  const [typeFilter, setTypeFilter] = useState<PromotionType | "All">("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  // quản lý đóng mở modal
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit" | "view" | "delete";
    editingRecord: PromotionRecord | null;
    isSubmitting: boolean;
  }>({ isOpen: false, mode: "add", editingRecord: null, isSubmitting: false });

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchStatus =
        statusFilter === "All" || record.status === statusFilter;
      const matchType = typeFilter === "All" || record.type === typeFilter;
      const matchSearch =
        !normalizedSearch ||
        record.name.toLowerCase().includes(normalizedSearch);

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
      setSelectedIds(new Set());
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changeStatusFilter: (status: PromotionStatus | "All") => {
      setStatusFilter(status);
      setSelectedIds(new Set());
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changeTypeFilter: (type: PromotionType | "All") => {
      setTypeFilter(type);
      setSelectedIds(new Set());
      setPagination((p) => ({ ...p, page: 1 }));
    },
    clearFilters: () => {
      setSearch("");
      setStatusFilter("All");
      setTypeFilter("All");
      setSelectedIds(new Set());
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

    changePage: (page: number) => {
      const safePage = Math.max(1, Math.min(page, totalPages));
      setPagination((p) => ({ ...p, page: safePage }));
    },
    changeLimit: (limit: number) => setPagination({ page: 1, limit }),

    openAddModal: () =>
      setModalConfig({
        isOpen: true,
        mode: "add",
        editingRecord: null,
        isSubmitting: false,
      }),
    openEditModal: (record: PromotionRecord) =>
      setModalConfig({
        isOpen: true,
        mode: "edit",
        editingRecord: record,
        isSubmitting: false,
      }),
    openViewModal: (record: PromotionRecord) =>
      setModalConfig({
        isOpen: true,
        mode: "view",
        editingRecord: record,
        isSubmitting: false,
      }),
    openDeleteModal: (record?: PromotionRecord) => {
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
        toast.success("Đã xóa khuyến mãi thành công!");
      } else {
        const deletedCount = selectedIds.size;
        setRecords((prev) => prev.filter((r) => !selectedIds.has(r.id)));
        toast.success(`Đã xóa ${deletedCount} khuyến mãi thành công!`);
        setSelectedIds(new Set());
      }
      setModalConfig((prev) => ({ ...prev, isOpen: false }));
    },
  };

  const toggleRowStatus = (id: string, currentStatus: PromotionStatus) => {
    if (currentStatus === "Expired") {
      toast.warning("Khuyến mãi đã hết hạn, không thể thay đổi trạng thái!");
      return;
    }
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: currentStatus === "Active" ? "Inactive" : "Active" }
          : r,
      ),
    );
    toast.success("Đã thay đổi trạng thái khuyến mãi!");
  };

  const handleModalSubmit = (data: PromotionFormData) => {
    const { mode, editingRecord } = modalConfig;

    if (!data.name.trim() || !data.startDate || !data.endDate) {
      toast.error("Vui lòng điền đầy đủ tên và thời gian khuyến mãi.");
      return;
    }

    if (!data.discountValueNum.trim()) {
      toast.error("Vui lòng nhập giá trị khuyến mãi.");
      return;
    }

    const discountValue = Number(data.discountValueNum);

    if (isNaN(discountValue)) {
      toast.error("Giá trị khuyến mãi không hợp lệ (chỉ chấp nhận số).");
      return;
    }

    if (discountValue <= 0) {
      toast.error("Giá trị khuyến mãi phải lớn hơn 0.");
      return;
    }

    if (data.discountType === "%" && discountValue > 100) {
      toast.error("Khuyến mãi theo phần trăm không được vượt quá 100%.");
      return;
    }

    const startDateObj = new Date(data.startDate);
    const endDateObj = new Date(data.endDate);

    if (endDateObj < startDateObj) {
      toast.error("Ngày kết thúc không được nhỏ hơn ngày bắt đầu.");
      return;
    }

    setModalConfig((prev) => ({ ...prev, isSubmitting: true }));

    // giả lập xử lý lưu dữ liệu
    setTimeout(() => {
      try {
        const formattedDiscountValue =
          data.discountType === "%"
            ? `${data.discountValueNum}% OFF`
            : `$${data.discountValueNum} Fixed`;

        if (mode === "add") {
          const newRecord: PromotionRecord = {
            id: nextIdCounter.current.toString(),
            name: data.name.trim(),
            type: data.type,
            discountValue: formattedDiscountValue,
            applicableScopeType: data.applicableScopeType,
            applicableScopeValues: data.applicableScopeValues,
            status: data.status,
            startDate: data.startDate,
            endDate: data.endDate,
            description: data.description,
          };
          nextIdCounter.current += 1;
          setRecords((prev) => [newRecord, ...prev]);
          setPagination((p) => ({ ...p, page: 1 }));
          toast.success("Thêm khuyến mãi thành công!");
        } else if (mode === "edit" && editingRecord) {
          setRecords((prev) =>
            prev.map((r) =>
              r.id === editingRecord.id
                ? {
                    ...r,
                    name: data.name.trim(),
                    type: data.type,
                    discountValue: formattedDiscountValue,
                    applicableScopeType: data.applicableScopeType,
                    applicableScopeValues: data.applicableScopeValues,
                    status: data.status,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    description: data.description,
                  }
                : r,
            ),
          );
          toast.success("Cập nhật khuyến mãi thành công!");
        }
        actions.closeModal();
      } catch {
        toast.error("Đã xảy ra lỗi trong quá trình lưu dữ liệu.");
        setModalConfig((prev) => ({ ...prev, isSubmitting: false }));
      }
    }, 400);
  };

  // nút bulk
  const bulkActions = {
    bulkActivate: () => {
      const targets = records.filter(
        (r) => selectedIds.has(r.id) && r.status !== "Expired",
      );
      if (targets.length === 0) return;

      setRecords((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id) && r.status !== "Expired"
            ? { ...r, status: "Active" }
            : r,
        ),
      );
      toast.success(`Đã kích hoạt ${targets.length} khuyến mãi!`);
      setSelectedIds(new Set());
    },

    bulkDeactivate: () => {
      const targets = records.filter(
        (r) => selectedIds.has(r.id) && r.status !== "Expired",
      );
      if (targets.length === 0) return;

      setRecords((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id) && r.status !== "Expired"
            ? { ...r, status: "Inactive" }
            : r,
        ),
      );
      toast.warning(`Đã vô hiệu hóa ${targets.length} khuyến mãi!`);
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
