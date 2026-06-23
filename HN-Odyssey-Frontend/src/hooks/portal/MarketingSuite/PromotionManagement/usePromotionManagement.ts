import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

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
  applicableScopeNames?: string[];
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

interface BEFlashSale {
  _id: string;
  name: string;
  discount_type: string;
  discount_value: number;
  applicable_scope_type: ApplicableScope;
  applicable_scope_values: string[];
  status: string;
  start_time: string;
  end_time: string;
  description?: string;
}

interface BECombo {
  _id: string;
  name: string;
  is_percent: boolean;
  discount_value: number;
  applicable_scope_type: ApplicableScope;
  applicable_scope_values: string[];
  status: string;
  start_date: string;
  end_date: string;
  description?: string;
}

interface BEProduct {
  _id: string;
  name: string;
}

interface BECategory {
  _id: string;
  name: string;
  children?: BECategory[];
}

interface BETag {
  _id: string;
  name: string;
}

interface ScopeOption {
  id: string;
  name: string;
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

const mapStatusToFE = (status: string): PromotionStatus => {
  if (status === "PENDING") return "Scheduled";
  if (status === "ACTIVE") return "Active";
  if (status === "EXPIRED") return "Expired";
  if (status === "DRAFT") return "Draft";
  return "Inactive";
};

const mapStatusToBE = (status: PromotionStatus) => {
  if (status === "Scheduled") return "PENDING";
  if (status === "Active") return "ACTIVE";
  if (status === "Expired") return "EXPIRED";
  if (status === "Draft") return "DRAFT";
  return "INACTIVE";
};

const flattenCategories = (
  nodes: BECategory[],
  parentPath = "",
): ScopeOption[] => {
  let result: ScopeOption[] = [];
  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;
    result.push({ id: node._id, name: currentPath });
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenCategories(node.children, currentPath));
    }
  }
  return result;
};

export function usePromotionManagement() {
  const [records, setRecords] = useState<PromotionRecord[]>([]);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<PromotionStatus | "All">(
    "All",
  );
  const [typeFilter, setTypeFilter] = useState<PromotionType | "All">("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit" | "view" | "delete";
    editingRecord: PromotionRecord | null;
    isSubmitting: boolean;
  }>({ isOpen: false, mode: "add", editingRecord: null, isSubmitting: false });

  const fetchPromotions = useCallback(async () => {
    try {
      const [fsRes, cbRes, prodRes, catRes, tagRes] = await Promise.all([
        axiosClient.get("/promotions/flash-sales?limit=1000"),
        axiosClient.get("/promotions/combos"),
        axiosClient.get("/products?limit=1000"),
        axiosClient.get("/categories/admin/tree-view"),
        axiosClient.get("/tags?limit=1000"),
      ]);

      const productsList: BEProduct[] =
        prodRes.data?.data?.data || prodRes.data?.data || [];
      const categoriesList: BECategory[] =
        catRes.data?.data || catRes.data || [];
      const tagsList: BETag[] = tagRes.data?.data || tagRes.data || [];

      const productMap = new Map(productsList.map((p) => [p._id, p.name]));
      const tagMap = new Map(tagsList.map((t) => [t._id, t.name]));
      const flatCategories = flattenCategories(categoriesList);
      const categoryMap = new Map(flatCategories.map((c) => [c.id, c.name]));

      const resolveNames = (
        type: ApplicableScope,
        values: string[],
      ): string[] => {
        return values.map((id) => {
          if (type === "Product") return productMap.get(id) || id;
          if (type === "Category") return categoryMap.get(id) || id;
          if (type === "Tag") return tagMap.get(id) || id;
          return id;
        });
      };

      const fsData: BEFlashSale[] =
        fsRes.data?.data?.data || fsRes.data?.data || [];
      const rawCbData = cbRes.data?.data || cbRes.data;
      const cbData: BECombo[] = Array.isArray(rawCbData) ? rawCbData : [];

      const mappedFs: PromotionRecord[] = fsData.map((item) => ({
        id: item._id,
        name: item.name,
        type: "Flash Sale",
        discountValue:
          item.discount_type === "PERCENTAGE"
            ? `${item.discount_value}% OFF`
            : `$${item.discount_value} Fixed`,
        applicableScopeType: item.applicable_scope_type,
        applicableScopeValues: item.applicable_scope_values || [],
        applicableScopeNames: resolveNames(
          item.applicable_scope_type,
          item.applicable_scope_values || [],
        ),
        status: mapStatusToFE(item.status),
        startDate: item.start_time
          ? new Date(item.start_time).toISOString().split("T")[0]
          : "",
        endDate: item.end_time
          ? new Date(item.end_time).toISOString().split("T")[0]
          : "",
        description: item.description || "",
      }));

      const mappedCb: PromotionRecord[] = cbData.map((item) => ({
        id: item._id,
        name: item.name,
        type: "Discount",
        discountValue: item.is_percent
          ? `${item.discount_value}% OFF`
          : `$${item.discount_value} Fixed`,
        applicableScopeType: item.applicable_scope_type,
        applicableScopeValues: item.applicable_scope_values || [],
        applicableScopeNames: resolveNames(
          item.applicable_scope_type,
          item.applicable_scope_values || [],
        ),
        status: mapStatusToFE(item.status),
        startDate: item.start_date
          ? new Date(item.start_date).toISOString().split("T")[0]
          : "",
        endDate: item.end_date
          ? new Date(item.end_date).toISOString().split("T")[0]
          : "",
        description: item.description || "",
      }));

      setRecords(
        [...mappedFs, ...mappedCb].sort(
          (a, b) =>
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
        ),
      );
    } catch (error) {
      console.error("Fetch Promotions Error:", error);
      toast.error(
        extractErrorMessage(error, "Không thể tải danh sách khuyến mãi!"),
      );
    }
  }, []);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

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
    openDeleteModal: (record?: PromotionRecord) =>
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
          const { id, type } = modalConfig.editingRecord;
          const endpoint =
            type === "Flash Sale"
              ? `/promotions/flash-sales/${id}`
              : `/promotions/combos/${id}`;
          const res = await axiosClient.delete(endpoint);
          toast.success(res.data?.message || "Đã xóa khuyến mãi thành công!");
        } else {
          const fsIds = Array.from(selectedIds).filter(
            (id) => records.find((r) => r.id === id)?.type === "Flash Sale",
          );
          const cbIds = Array.from(selectedIds).filter(
            (id) => records.find((r) => r.id === id)?.type === "Discount",
          );
          const res = await axiosClient.post("/promotions/bulk/delete", {
            flashSaleIds: fsIds,
            comboIds: cbIds,
          });

          const msg = res.data?.message || `Đã xóa thành công!`;
          if (msg.includes("bị bỏ qua")) {
            toast.warning(msg);
          } else {
            toast.success(msg);
          }
        }
        setSelectedIds(new Set());
        fetchPromotions();
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      } catch (error: unknown) {
        console.error("Delete Promotions Error:", error);
        toast.error(extractErrorMessage(error, "Lỗi khi xóa dữ liệu!"));
      }
    },
  };

  const toggleRowStatus = async (
    id: string,
    currentStatus: PromotionStatus,
  ) => {
    if (currentStatus === "Expired") {
      toast.warning("Khuyến mãi đã hết hạn, không thể thay đổi trạng thái!");
      return;
    }
    const record = records.find((r) => r.id === id);
    if (!record) return;

    const newStatusFE = currentStatus === "Active" ? "Inactive" : "Active";
    const beStatus = mapStatusToBE(newStatusFE);
    const endpoint =
      record.type === "Flash Sale"
        ? `/promotions/flash-sales/${id}`
        : `/promotions/combos/${id}`;

    try {
      const res = await axiosClient.patch(endpoint, { status: beStatus });
      fetchPromotions();
      toast.success(res.data?.message || "Đã thay đổi trạng thái khuyến mãi!");
    } catch (error: unknown) {
      console.error("Toggle Status Error:", error);
      toast.error(extractErrorMessage(error, "Lỗi khi cập nhật trạng thái!"));
    }
  };

  const handleModalSubmit = async (data: PromotionFormData) => {
    const { mode, editingRecord } = modalConfig;

    if (!data.name.trim() || !data.startDate || !data.endDate)
      return toast.error("Vui lòng điền đầy đủ tên và thời gian.");
    if (
      !data.discountValueNum.trim() ||
      isNaN(Number(data.discountValueNum)) ||
      Number(data.discountValueNum) <= 0
    )
      return toast.error("Giá trị không hợp lệ.");
    if (data.discountType === "%" && Number(data.discountValueNum) > 100)
      return toast.error("Phần trăm không được vượt 100%.");

    // ==========================================
    // BẢN FIX CUỐI CÙNG Ở ĐÂY:
    // Nếu trạng thái muốn lưu KHÔNG PHẢI là Draft và Inactive,
    // thì bắt buộc phải có Sản phẩm/Danh mục. Còn lại thì cho lưu rỗng thoải mái!
    // ==========================================
    if (
      data.status !== "Draft" &&
      data.status !== "Inactive" &&
      data.applicableScopeValues.length === 0
    ) {
      return toast.error("Vui lòng chọn phạm vi áp dụng để Công bố.");
    }

    const sDate = new Date(data.startDate);
    sDate.setHours(0, 0, 0, 0);
    const eDate = new Date(data.endDate);
    eDate.setHours(23, 59, 59, 999);
    if (eDate < sDate)
      return toast.error("Ngày kết thúc phải lớn hơn ngày bắt đầu.");

    setModalConfig((prev) => ({ ...prev, isSubmitting: true }));

    try {
      const isDraft = data.status === "Draft";
      const statusBE = isDraft
        ? "DRAFT"
        : new Date() < sDate
          ? "PENDING"
          : "ACTIVE";

      const payload: Record<
        string,
        string | number | boolean | string[] | undefined
      > = {
        name: data.name.trim(),
        description: data.description,
        applicable_scope_type: data.applicableScopeType,
        applicable_scope_values: data.applicableScopeValues,
        status: statusBE,
      };

      let responseMsg = "";

      if (data.type === "Flash Sale") {
        payload.discount_type =
          data.discountType === "%" ? "PERCENTAGE" : "FIXED_PRICE";
        payload.discount_value = Number(data.discountValueNum);
        payload.start_time = sDate.toISOString();
        payload.end_time = eDate.toISOString();

        if (mode === "add") {
          const res = await axiosClient.post(
            "/promotions/flash-sales",
            payload,
          );
          responseMsg = res.data?.message;
        } else {
          const res = await axiosClient.patch(
            `/promotions/flash-sales/${editingRecord!.id}`,
            payload,
          );
          responseMsg = res.data?.message;
        }
      } else {
        payload.type = "DIRECT_DISCOUNT";
        payload.is_percent = data.discountType === "%";
        payload.discount_value = Number(data.discountValueNum);
        payload.start_date = sDate.toISOString();
        payload.end_date = eDate.toISOString();
        payload.min_quantity = 1;

        if (mode === "add") {
          const res = await axiosClient.post("/promotions/combos", payload);
          responseMsg = res.data?.message;
        } else {
          const res = await axiosClient.patch(
            `/promotions/combos/${editingRecord!.id}`,
            payload,
          );
          responseMsg = res.data?.message;
        }
      }

      toast.success(
        responseMsg ||
          (mode === "add"
            ? "Thêm khuyến mãi thành công!"
            : "Cập nhật thành công!"),
      );
      fetchPromotions();
      actions.closeModal();
    } catch (error: unknown) {
      console.error("Submit Promotion Error:", error);
      toast.error(
        extractErrorMessage(error, "Lỗi khi lưu dữ liệu vào hệ thống!"),
      );
    } finally {
      setModalConfig((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const bulkActions = {
    bulkActivate: async () => {
      try {
        const fsIds = Array.from(selectedIds).filter(
          (id) => records.find((r) => r.id === id)?.type === "Flash Sale",
        );
        const cbIds = Array.from(selectedIds).filter(
          (id) => records.find((r) => r.id === id)?.type === "Discount",
        );

        const res = await axiosClient.patch("/promotions/bulk/status", {
          flashSaleIds: fsIds,
          comboIds: cbIds,
          action: "ACTIVATE",
        });
        toast.success(
          res.data?.message || `Đã kích hoạt các khuyến mãi được chọn!`,
        );

        setSelectedIds(new Set());
        fetchPromotions();
      } catch (error: unknown) {
        console.error("Bulk Activate Error:", error);
        toast.error(
          extractErrorMessage(error, "Có lỗi xảy ra khi kích hoạt bulk"),
        );
      }
    },
    bulkDeactivate: async () => {
      try {
        const fsIds = Array.from(selectedIds).filter(
          (id) => records.find((r) => r.id === id)?.type === "Flash Sale",
        );
        const cbIds = Array.from(selectedIds).filter(
          (id) => records.find((r) => r.id === id)?.type === "Discount",
        );

        const res = await axiosClient.patch("/promotions/bulk/status", {
          flashSaleIds: fsIds,
          comboIds: cbIds,
          action: "DEACTIVATE",
        });
        toast.success(
          res.data?.message || `Đã vô hiệu hóa khuyến mãi được chọn!`,
        );

        setSelectedIds(new Set());
        fetchPromotions();
      } catch (error: unknown) {
        console.error("Bulk Deactivate Error:", error);
        toast.error(
          extractErrorMessage(error, "Có lỗi xảy ra khi vô hiệu hóa bulk"),
        );
      }
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
