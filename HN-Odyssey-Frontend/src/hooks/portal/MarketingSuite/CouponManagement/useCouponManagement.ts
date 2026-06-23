import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

export type CouponStatus = "ACTIVE" | "INACTIVE" | "CANCELLED" | "DRAFT";
export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

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

interface BeCouponResponse {
  _id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_value: number;
  max_discount_amount?: number;
  start_date: string;
  end_date: string;
  usage_limit: number;
  usage_count: number;
  user_usage_limit: number;
  status: CouponStatus;
  applicable_scope?: ApplicableScopeObj;
}

interface BePaginatedResponse {
  data: {
    data: BeCouponResponse[];
    meta: {
      totalItems: number;
      itemCount: number;
      itemsPerPage: number;
      totalPages: number;
      currentPage: number;
    };
  };
}

interface APIErrorResponse {
  response?: {
    data?: {
      message?: string | string[];
    };
  };
}

const extractErrorMessage = (error: unknown, defaultMsg: string): string => {
  try {
    const err = error as APIErrorResponse;
    const beMessage = err?.response?.data?.message;
    if (Array.isArray(beMessage) && beMessage.length > 0) {
      return beMessage[0];
    }
    if (typeof beMessage === "string") {
      return beMessage;
    }
    return defaultMsg;
  } catch {
    return defaultMsg;
  }
};

export function useCouponManagement() {
  const [records, setRecords] = useState<CouponRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<CouponStatus | "All">("All");
  const [discountTypeFilter, setDiscountTypeFilter] = useState<
    DiscountType | "All"
  >("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalPages: 0,
    totalFiltered: 0,
  });

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit" | "view" | "delete";
    editingRecord: CouponRecord | null;
    isSubmitting: boolean;
  }>({ isOpen: false, mode: "add", editingRecord: null, isSubmitting: false });

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  };

  const formatDiscount = (type: DiscountType, value: number) => {
    return type === "PERCENTAGE" ? `${value}%` : `$${value.toFixed(2)}`;
  };

  const fetchCoupons = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (search) params.search = search;
      if (statusFilter !== "All") params.status = statusFilter;

      const res = await axiosClient.get<BePaginatedResponse>(
        "/promotions/coupons",
        { params },
      );

      const mappedData: CouponRecord[] = res.data.data.data.map((item) => ({
        id: item._id,
        code: item.code,
        discountType: item.discount_type,
        discountValue: formatDiscount(item.discount_type, item.discount_value),
        usedCount: item.usage_count,
        totalUses: item.usage_limit,
        perCustomerLimit: item.user_usage_limit,
        status: item.status,
        startDate: formatDate(item.start_date),
        endDate: formatDate(item.end_date),
        minimumOrderValue: item.min_order_value,
        maximumDiscountAmount: item.max_discount_amount,
        applicableScope: item.applicable_scope || {
          isAllProducts: true,
          categories: [],
          tags: [],
          products: [],
        },
      }));

      setRecords(mappedData);
      setPagination((p) => ({
        ...p,
        totalPages: res.data.data.meta.totalPages,
        totalFiltered: res.data.data.meta.totalItems,
      }));
    } catch (error: unknown) {
      toast.error(
        extractErrorMessage(error, "Lỗi khi tải danh sách mã giảm giá"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter]);

  const displayRecords = useMemo(() => {
    if (discountTypeFilter === "All") return records;
    return records.filter((r) => r.discountType === discountTypeFilter);
  }, [records, discountTypeFilter]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const actions = {
    changeSearch: (val: string) => {
      setSearch(val);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changeStatusFilter: (status: CouponStatus | "All") => {
      setStatusFilter(status);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changeDiscountTypeFilter: (type: DiscountType | "All") => {
      setDiscountTypeFilter(type);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    clearFilters: () => {
      setSearch("");
      setStatusFilter("All");
      setDiscountTypeFilter("All");
      setPagination((p) => ({ ...p, page: 1 }));
    },
    toggleSelection: (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    toggleSelectAll: (isSelectAll: boolean) => {
      setSelectedIds(
        isSelectAll ? new Set(displayRecords.map((r) => r.id)) : new Set(),
      );
    },
    changePage: (page: number) => setPagination((p) => ({ ...p, page })),
    changeLimit: (limit: number) =>
      setPagination((p) => ({ ...p, page: 1, limit })),
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
    openDeleteModal: (record?: CouponRecord) =>
      setModalConfig({
        isOpen: true,
        mode: "delete",
        editingRecord: record || null,
        isSubmitting: false,
      }),
    closeModal: () =>
      setModalConfig({
        isOpen: false,
        mode: "add",
        editingRecord: null,
        isSubmitting: false,
      }),

    handleConfirmDelete: async () => {
      try {
        if (modalConfig.editingRecord) {
          await axiosClient.delete(
            `/promotions/coupons/${modalConfig.editingRecord.id}`,
          );
          toast.success("Xóa mã giảm giá thành công!");
        } else {
          const res = await axiosClient.post("/promotions/bulk/delete", {
            couponIds: Array.from(selectedIds),
          });

          const msg = res.data?.message || "Xóa hàng loạt thành công!";
          if (msg.includes("chặn xóa") || msg.includes("bỏ qua")) {
            toast.warning(msg);
          } else {
            toast.success(msg);
          }
        }
        setSelectedIds(new Set());
        actions.closeModal();
        fetchCoupons();
      } catch (error: unknown) {
        toast.error(extractErrorMessage(error, "Có lỗi xảy ra khi xóa"));
      }
    },
  };

  const handleModalSubmit = async (data: CouponFormData) => {
    try {
      setModalConfig((prev) => ({ ...prev, isSubmitting: true }));

      const payload = {
        code: data.code,
        description: `Mã giảm giá ${data.code}`,
        discount_type: data.discountType,
        discount_value: Number(data.discountValueNum),
        min_order_value: Number(data.minimumOrderValueNum || 0),
        max_discount_amount: data.maximumDiscountAmountNum
          ? Number(data.maximumDiscountAmountNum)
          : undefined,
        start_date: new Date(
          data.startDate.split("/").reverse().join("-"),
        ).toISOString(),
        end_date: new Date(
          data.endDate.split("/").reverse().join("-"),
        ).toISOString(),
        usage_limit: Number(data.totalUsesNum),
        user_usage_limit: Number(data.perCustomerLimitNum || 1),
        status: data.isDraft ? "DRAFT" : "ACTIVE",
        applicable_scope: data.applicableScope,
      };

      if (modalConfig.mode === "add") {
        await axiosClient.post("/promotions/coupons", payload);
        toast.success("Tạo mã giảm giá thành công!");
      } else if (modalConfig.mode === "edit" && modalConfig.editingRecord) {
        const updatePayload: Partial<typeof payload> = { ...payload };
        delete updatePayload.code;

        await axiosClient.patch(
          `/promotions/coupons/${modalConfig.editingRecord.id}`,
          updatePayload,
        );
        toast.success("Cập nhật mã giảm giá thành công!");
      }

      actions.closeModal();
      fetchCoupons();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, "Có lỗi xảy ra khi lưu dữ liệu"));
    } finally {
      setModalConfig((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const bulkActions = {
    bulkActivate: async () => {
      if (selectedIds.size === 0) return;
      try {
        await axiosClient.patch("/promotions/bulk/status", {
          couponIds: Array.from(selectedIds),
          action: "ACTIVATE",
        });
        toast.success("Kích hoạt hàng loạt thành công!");
        setSelectedIds(new Set());
        fetchCoupons();
      } catch (error: unknown) {
        toast.error(extractErrorMessage(error, "Có lỗi xảy ra khi kích hoạt"));
      }
    },
    bulkDeactivate: async () => {
      if (selectedIds.size === 0) return;
      try {
        await axiosClient.patch("/promotions/bulk/status", {
          couponIds: Array.from(selectedIds),
          action: "DEACTIVATE",
        });
        toast.success("Vô hiệu hóa hàng loạt thành công!");
        setSelectedIds(new Set());
        fetchCoupons();
      } catch (error: unknown) {
        toast.error(
          extractErrorMessage(error, "Có lỗi xảy ra khi vô hiệu hóa"),
        );
      }
    },
    bulkDelete: () => actions.openDeleteModal(),
  };

  return {
    currentRecords: displayRecords,
    pagination: {
      ...pagination,
      startIndex: (pagination.page - 1) * pagination.limit,
    },
    search,
    statusFilter,
    discountTypeFilter,
    selectedIds,
    modalConfig,
    actions,
    handleModalSubmit,
    bulkActions,
    isLoading,
  };
}
