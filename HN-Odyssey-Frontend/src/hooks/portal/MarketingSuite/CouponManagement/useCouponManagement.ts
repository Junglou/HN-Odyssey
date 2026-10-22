import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";
import type { UserPayload } from "../../../../types/auth";
import { Action, Resource } from "../../../../types/permissions";
import { USER_KEY } from "../../../../utils/tokenStorage";

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

// Khắc phục lỗi React Hook useEffect setState bằng cách khởi tạo Lazy Initial State
const useLocalAuth = () => {
  const [user] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      if (stored) return JSON.parse(stored) as UserPayload;
    } catch {
      // Bỏ qua lỗi parse
    }
    return null;
  });
  return { user };
};

export function useCouponManagement() {
  // Loại bỏ hoàn toàn cú pháp useState để tránh lỗi Parser toán tử trong file .ts
  const [records, setRecords] = useState<CouponRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
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

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    mode: "add" as "add" | "edit" | "view" | "delete",
    editingRecord: null as CouponRecord | null,
    isSubmitting: false,
  });

  const { user } = useLocalAuth();

  const hasPermission = useCallback(
    (resourceCode: Resource, actionCode: Action): boolean => {
      if (!user || !user.permissions) return false;
      if (user.roles?.includes("SUPER_ADMIN")) return true;

      return user.permissions.some(
        (p) =>
          p.resource === resourceCode &&
          (p.actions.includes(actionCode) || p.actions.includes(Action.MANAGE)),
      );
    },
    [user],
  );

  const canCreate = hasPermission(Resource.PROMO_COUPONS, Action.CREATE);
  const canUpdate = hasPermission(Resource.PROMO_COUPONS, Action.UPDATE);
  const canDelete = hasPermission(Resource.PROMO_COUPONS, Action.DELETE);
  // Bật/tắt dùng quyền CHANGE_STATUS
  const canPublish = hasPermission(
    Resource.PROMO_COUPONS,
    Action.CHANGE_STATUS,
  );

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${day}/${month}/${d.getFullYear()}`;
  };

  const formatDiscount = (type: DiscountType, value: number) => {
    return type === "PERCENTAGE" ? `${value}%` : `$${value.toFixed(2)}`;
  };

  const fetchCoupons = useCallback(async () => {
    setIsLoading(true);
    try {
      // Thay thế Record bằng định nghĩa object tường minh để tránh lỗi Generic
      const params: { [key: string]: string | number } = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (search) params.search = search;
      if (statusFilter !== "All") params.status = statusFilter;

      const res = await axiosClient.get("/promotions/coupons", { params });

      const rawData = res.data?.data?.data || [];
      const meta = res.data?.data?.meta || {
        totalPages: 1,
        totalItems: rawData.length,
      };

      const mappedData: CouponRecord[] = rawData.map(
        (item: BeCouponResponse) => ({
          id: item._id,
          code: item.code,
          discountType: item.discount_type,
          discountValue: formatDiscount(
            item.discount_type,
            item.discount_value,
          ),
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
        }),
      );

      setRecords(mappedData);
      setPagination((p: typeof pagination) => ({
        ...p,
        totalPages: meta.totalPages,
        totalFiltered: meta.totalItems,
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
      setPagination((p: typeof pagination) => ({ ...p, page: 1 }));
    },
    changeStatusFilter: (status: CouponStatus | "All") => {
      setStatusFilter(status);
      setPagination((p: typeof pagination) => ({ ...p, page: 1 }));
    },
    changeDiscountTypeFilter: (type: DiscountType | "All") => {
      setDiscountTypeFilter(type);
      setPagination((p: typeof pagination) => ({ ...p, page: 1 }));
    },
    clearFilters: () => {
      setSearch("");
      setStatusFilter("All");
      setDiscountTypeFilter("All");
      setPagination((p: typeof pagination) => ({ ...p, page: 1 }));
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
    changePage: (page: number) =>
      setPagination((p: typeof pagination) => ({ ...p, page })),
    changeLimit: (limit: number) =>
      setPagination((p: typeof pagination) => ({ ...p, page: 1, limit })),

    openAddModal: () => {
      if (!canCreate) return toast.error("Bạn không có quyền tạo mã giảm giá.");
      setModalConfig({
        isOpen: true,
        mode: "add",
        editingRecord: null,
        isSubmitting: false,
      });
    },
    openEditModal: (record: CouponRecord) => {
      if (!canUpdate) return toast.error("Bạn không có quyền sửa mã giảm giá.");
      setModalConfig({
        isOpen: true,
        mode: "edit",
        editingRecord: record,
        isSubmitting: false,
      });
    },
    openViewModal: (record: CouponRecord) =>
      setModalConfig({
        isOpen: true,
        mode: "view",
        editingRecord: record,
        isSubmitting: false,
      }),
    openDeleteModal: (record?: CouponRecord) => {
      if (!canDelete) return toast.error("Bạn không có quyền xóa mã giảm giá.");
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

    handleConfirmDelete: async () => {
      try {
        if (modalConfig.editingRecord) {
          await axiosClient.delete(
            `/promotions/coupons/${modalConfig.editingRecord.id}`,
          );
          toast.success("Xóa mã giảm giá thành công!");
        } else {
          const res = await axiosClient.post(
            "/promotions/coupons/bulk/delete",
            {
              ids: Array.from(selectedIds),
            },
          );

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
      setModalConfig((prev: typeof modalConfig) => ({
        ...prev,
        isSubmitting: true,
      }));

      // Sửa lỗi Generic Record và xóa escape vô ích
      const payload: { [key: string]: unknown } = {
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
        applicable_scope: data.applicableScope,
      };

      // Bật/tắt đi qua bulk/status (quyền CHANGE_STATUS), không gửi trong payload sửa
      const wantActive = !data.isDraft;
      let statusNote = "";
      const changeStatus = async (
        id: string,
        action: "ACTIVATE" | "DEACTIVATE",
      ) => {
        if (!canPublish) {
          statusNote =
            " Bạn không có quyền bật/tắt nên trạng thái được giữ nguyên.";
          return;
        }
        await axiosClient.patch("/promotions/coupons/bulk/status", {
          ids: [id],
          action,
        });
      };

      if (modalConfig.mode === "add") {
        const res = await axiosClient.post("/promotions/coupons", payload);
        const newId: string | undefined = res.data?.data?._id;
        if (wantActive && newId) await changeStatus(newId, "ACTIVATE");
      } else if (modalConfig.mode === "edit" && modalConfig.editingRecord) {
        const couponId = modalConfig.editingRecord.id;
        const wasActive = modalConfig.editingRecord.status === "ACTIVE";

        // Tắt TRƯỚC khi sửa (BE chỉ cho sửa thông tin cốt lõi khi mã đã tắt)
        if (wasActive && !wantActive)
          await changeStatus(couponId, "DEACTIVATE");

        const updatePayload = { ...payload };
        delete updatePayload.code;
        await axiosClient.patch(
          `/promotions/coupons/${couponId}`,
          updatePayload,
        );

        // Bật SAU khi sửa
        if (!wasActive && wantActive) await changeStatus(couponId, "ACTIVATE");
      }

      const baseMsg =
        modalConfig.mode === "add"
          ? "Tạo mã giảm giá thành công!"
          : "Cập nhật mã giảm giá thành công!";
      if (statusNote) toast.warning(baseMsg + statusNote);
      else toast.success(baseMsg);

      actions.closeModal();
      fetchCoupons();
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, "Có lỗi xảy ra khi lưu dữ liệu"));
    } finally {
      setModalConfig((prev: typeof modalConfig) => ({
        ...prev,
        isSubmitting: false,
      }));
    }
  };

  const bulkActions = {
    bulkActivate: async () => {
      if (!canPublish)
        return toast.error("Bạn không có quyền xuất bản mã giảm giá.");
      if (selectedIds.size === 0) return;
      try {
        await axiosClient.patch("/promotions/coupons/bulk/status", {
          ids: Array.from(selectedIds),
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
      if (!canPublish)
        return toast.error("Bạn không có quyền thu hồi mã giảm giá.");
      if (selectedIds.size === 0) return;
      try {
        await axiosClient.patch("/promotions/coupons/bulk/status", {
          ids: Array.from(selectedIds),
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
    bulkDelete: () => {
      if (!canDelete) return toast.error("Bạn không có quyền xóa mã giảm giá.");
      if (selectedIds.size === 0) return;
      actions.openDeleteModal();
    },
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
    permissions: {
      canCreate,
      canUpdate,
      canDelete,
      canPublish,
    },
  };
}
