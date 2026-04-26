import { useState, useRef, useMemo } from "react";
import { toast } from "react-toastify";

// prop
export type CouponStatus =
  | "Active"
  | "Inactive"
  | "Scheduled"
  | "Expired"
  | "Draft";
export type DiscountType = "Percentage" | "Fixed Amount";

export interface ApplicableScopeObj {
  isAllProducts: boolean;
  categories: string[];
  tags: string[];
  products: string[];
}

export interface CouponRecord {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: string;
  usedCount: number;
  totalUses: number;
  perCustomerLimit?: number;
  status: CouponStatus;
  startDate: string;
  endDate: string;
  minimumOrderValue?: number;
  maximumDiscountAmount?: number;
  applicableScope: ApplicableScopeObj;
}

export interface CouponFormData {
  code: string;
  discountType: DiscountType;
  discountValueNum: string;
  minimumOrderValueNum: string;
  maximumDiscountAmountNum: string;
  totalUsesNum: string;
  perCustomerLimitNum: string;
  startDate: string;
  endDate: string;
  applicableScope: ApplicableScopeObj;
  isDraft: boolean;
}

// Mock data
const INITIAL_COUPONS: CouponRecord[] = [
  {
    id: "1",
    code: "SUMMER20",
    discountType: "Percentage",
    discountValue: "20%",
    usedCount: 50,
    totalUses: 500,
    status: "Active",
    startDate: "01/06/2024",
    endDate: "31/07/2024",
    applicableScope: {
      isAllProducts: false,
      categories: [],
      tags: ["Summer Collection"],
      products: [],
    },
  },
  {
    id: "2",
    code: "WELCOME10",
    discountType: "Fixed Amount",
    discountValue: "$10.00",
    usedCount: 10,
    totalUses: 1000,
    status: "Active",
    startDate: "01/01/2024",
    endDate: "31/12/2024",
    applicableScope: {
      isAllProducts: true,
      categories: [],
      tags: [],
      products: [],
    },
  },
  {
    id: "3",
    code: "FLASH50",
    discountType: "Percentage",
    discountValue: "50%",
    usedCount: 10,
    totalUses: 100,
    status: "Scheduled",
    startDate: "15/11/2024",
    endDate: "17/11/2024",
    applicableScope: {
      isAllProducts: true,
      categories: [],
      tags: [],
      products: [],
    },
  },
  {
    id: "4",
    code: "TESTCODE",
    discountType: "Fixed Amount",
    discountValue: "$5.00",
    usedCount: 10,
    totalUses: 50,
    status: "Expired",
    startDate: "01/03/2024",
    endDate: "30/04/2024",
    applicableScope: {
      isAllProducts: true,
      categories: [],
      tags: [],
      products: [],
    },
  },
  {
    id: "5",
    code: "OLDPROMO",
    discountType: "Percentage",
    discountValue: "15%",
    usedCount: 20,
    totalUses: 200,
    status: "Draft",
    startDate: "01/08/2024",
    endDate: "15/09/2024",
    applicableScope: {
      isAllProducts: true,
      categories: [],
      tags: [],
      products: [],
    },
  },
];

export function useCouponManagement() {
  const [records, setRecords] = useState<CouponRecord[]>(INITIAL_COUPONS);
  const nextIdCounter = useRef<number>(6);

  // State quản lý bộ lọc và tìm kiếm
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<CouponStatus | "All">("All");
  const [discountTypeFilter, setDiscountTypeFilter] = useState<
    DiscountType | "All"
  >("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  // State quản lý Modal
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit" | "view" | "delete";
    editingRecord: CouponRecord | null;
    isSubmitting: boolean;
  }>({ isOpen: false, mode: "add", editingRecord: null, isSubmitting: false });

  // Lọc dữ liệu
  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchStatus =
        statusFilter === "All" || record.status === statusFilter;
      const matchType =
        discountTypeFilter === "All" ||
        record.discountType === discountTypeFilter;
      const matchSearch =
        !normalizedSearch ||
        record.code.toLowerCase().includes(normalizedSearch);

      return matchStatus && matchType && matchSearch;
    });
  }, [records, search, statusFilter, discountTypeFilter]);

  // Phân trang
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
    changeStatusFilter: (status: CouponStatus | "All") => {
      setStatusFilter(status);
      setSelectedIds(new Set());
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changeDiscountTypeFilter: (type: DiscountType | "All") => {
      setDiscountTypeFilter(type);
      setSelectedIds(new Set());
      setPagination((p) => ({ ...p, page: 1 }));
    },
    clearFilters: () => {
      setSearch("");
      setStatusFilter("All");
      setDiscountTypeFilter("All");
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
    openEditModal: (record: CouponRecord) =>
      setModalConfig({
        isOpen: true,
        mode: "edit",
        editingRecord: record,
        isSubmitting: false,
      }),
    openViewModal: (record: CouponRecord) =>
      setModalConfig({
        isOpen: true,
        mode: "view",
        editingRecord: record,
        isSubmitting: false,
      }),
    openDeleteModal: (record?: CouponRecord) => {
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
        toast.success("Đã xóa coupon thành công!", { toastId: `del-${id}` });
      } else {
        const deletedCount = selectedIds.size;
        setRecords((prev) => prev.filter((r) => !selectedIds.has(r.id)));
        toast.success(`Đã xóa ${deletedCount} coupon thành công!`, {
          toastId: "del-bulk",
        });
        setSelectedIds(new Set());
      }
      setModalConfig((prev) => ({ ...prev, isOpen: false }));
    },
  };

  // Xử lý submit form
  const handleModalSubmit = (data: CouponFormData) => {
    const { mode, editingRecord } = modalConfig;

    if (!data.code.trim()) {
      toast.error("Vui lòng nhập mã Coupon Code.", { toastId: "err-code" });
      return;
    }

    if (!data.startDate || !data.endDate) {
      toast.error("Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc.", {
        toastId: "err-date",
      });
      return;
    }

    const parseDate = (dateStr: string) => {
      const [day, month, year] = dateStr.split("/");
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const startDateObj = parseDate(data.startDate);
    const endDateObj = parseDate(data.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDateObj.setHours(23, 59, 59, 999);

    if (endDateObj < startDateObj) {
      toast.error("Ngày kết thúc không được nhỏ hơn ngày bắt đầu.", {
        toastId: "err-date-logic",
      });
      return;
    }

    // Validate Scope
    const scope = data.applicableScope;
    if (
      !scope.isAllProducts &&
      scope.categories.length === 0 &&
      scope.tags.length === 0 &&
      scope.products.length === 0
    ) {
      toast.error(
        "Vui lòng chọn ít nhất một phạm vi áp dụng (Danh mục, Tag hoặc Sản phẩm).",
        { toastId: "err-scope" },
      );
      return;
    }

    const discountValue = Number(data.discountValueNum);
    if (
      !data.discountValueNum.trim() ||
      isNaN(discountValue) ||
      discountValue <= 0
    ) {
      toast.error("Giá trị giảm giá phải lớn hơn 0.", { toastId: "err-val" });
      return;
    }

    if (data.discountType === "Percentage" && discountValue > 100) {
      toast.error("Giảm giá theo phần trăm không vượt quá 100%.", {
        toastId: "err-percent",
      });
      return;
    }

    // Validate giới hạn sử dụng
    const totalUses = Number(data.totalUsesNum);
    if (!data.totalUsesNum.trim() || isNaN(totalUses) || totalUses <= 0) {
      toast.error("Vui lòng nhập giới hạn sử dụng tổng cộng hợp lệ.", {
        toastId: "err-total",
      });
      return;
    }

    if (data.minimumOrderValueNum && Number(data.minimumOrderValueNum) < 0) {
      toast.error("Giá trị đơn hàng tối thiểu không được âm.", {
        toastId: "err-min-order",
      });
      return;
    }
    if (
      data.maximumDiscountAmountNum &&
      Number(data.maximumDiscountAmountNum) < 0
    ) {
      toast.error("Số tiền giảm tối đa không được âm.", {
        toastId: "err-max-discount",
      });
      return;
    }
    if (data.perCustomerLimitNum && Number(data.perCustomerLimitNum) < 0) {
      toast.error("Giới hạn sử dụng mỗi khách hàng không được âm.", {
        toastId: "err-per-cust",
      });
      return;
    }

    setModalConfig((prev) => ({ ...prev, isSubmitting: true }));

    // Giả lập API lưu dữ liệu
    setTimeout(() => {
      try {
        const formattedDiscountValue =
          data.discountType === "Percentage"
            ? `${data.discountValueNum}%`
            : `$${parseFloat(data.discountValueNum).toFixed(2)}`;

        const computeStatus = (isDraft: boolean): CouponStatus => {
          if (isDraft) return "Draft";
          if (today > endDateObj) return "Expired";
          if (today < startDateObj) return "Scheduled";
          return "Active";
        };

        const derivedStatus: CouponStatus = computeStatus(data.isDraft);

        if (mode === "add") {
          const newRecord: CouponRecord = {
            id: nextIdCounter.current.toString(),
            code: data.code.trim().toUpperCase(),
            discountType: data.discountType,
            discountValue: formattedDiscountValue,
            usedCount: 0,
            totalUses: totalUses,
            perCustomerLimit: data.perCustomerLimitNum
              ? Number(data.perCustomerLimitNum)
              : undefined,
            status: derivedStatus,
            startDate: data.startDate,
            endDate: data.endDate,
            minimumOrderValue: data.minimumOrderValueNum
              ? Number(data.minimumOrderValueNum)
              : undefined,
            maximumDiscountAmount: data.maximumDiscountAmountNum
              ? Number(data.maximumDiscountAmountNum)
              : undefined,
            applicableScope: data.applicableScope,
          };
          nextIdCounter.current += 1;
          setRecords((prev) => [newRecord, ...prev]);
          setPagination((p) => ({ ...p, page: 1 }));
          toast.success("Tạo mã coupon thành công!", {
            toastId: "add-success",
          });
        } else if (mode === "edit" && editingRecord) {
          setRecords((prev) =>
            prev.map((r) =>
              r.id === editingRecord.id
                ? {
                    ...r,
                    code: data.code.trim().toUpperCase(),
                    discountType: data.discountType,
                    discountValue: formattedDiscountValue,
                    totalUses: totalUses,
                    perCustomerLimit: data.perCustomerLimitNum
                      ? Number(data.perCustomerLimitNum)
                      : undefined,
                    status: derivedStatus,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    minimumOrderValue: data.minimumOrderValueNum
                      ? Number(data.minimumOrderValueNum)
                      : undefined,
                    maximumDiscountAmount: data.maximumDiscountAmountNum
                      ? Number(data.maximumDiscountAmountNum)
                      : undefined,
                    applicableScope: data.applicableScope,
                  }
                : r,
            ),
          );
          toast.success("Cập nhật mã coupon thành công!", {
            toastId: "edit-success",
          });
        }
        actions.closeModal();
      } catch {
        toast.error("Lưu dữ liệu thất bại. Thử lại sau.", {
          toastId: "err-save",
        });
        setModalConfig((prev) => ({ ...prev, isSubmitting: false }));
      }
    }, 400);
  };

  // Thao tác hàng loạt
  const bulkActions = {
    bulkActivate: () => {
      const targets = records.filter(
        (r) => selectedIds.has(r.id) && r.status !== "Expired",
      );
      if (targets.length === 0) return;

      setRecords((prev) =>
        prev.map((r) => {
          if (selectedIds.has(r.id) && r.status !== "Expired") {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const [day, month, year] = r.startDate.split("/");
            const sDate = new Date(
              Number(year),
              Number(month) - 1,
              Number(day),
            );
            sDate.setHours(0, 0, 0, 0);

            const newStatus = today < sDate ? "Scheduled" : "Active";
            return { ...r, status: newStatus };
          }
          return r;
        }),
      );
      toast.success(`Đã kích hoạt ${targets.length} coupon!`, {
        toastId: "bulk-act",
      });
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
      toast.warning(`Đã vô hiệu hóa ${targets.length} coupon!`, {
        toastId: "bulk-deact",
      });
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
    discountTypeFilter,
    selectedIds,
    modalConfig,
    actions,
    handleModalSubmit,
    bulkActions,
  };
}
