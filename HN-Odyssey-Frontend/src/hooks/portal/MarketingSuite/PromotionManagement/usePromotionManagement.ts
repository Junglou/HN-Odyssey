import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";
import { Action, Resource } from "../../../../types/permissions";
import type { UserPayload } from "../../../../types/auth";
import { USER_KEY } from "../../../../utils/tokenStorage";

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

const useLocalAuth = () => {
  const [user] = useState<UserPayload | null>(() => {
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

export function usePromotionManagement() {
  const [records, setRecords] = useState<PromotionRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState("");
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

  // --- FIX: THÊM LOGIC RBAC CHUẨN KHÔNG DÙNG ANY ---
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

  const canCreateFlashSale = hasPermission(
    Resource.PROMO_FLASH_SALES,
    Action.CREATE,
  );
  const canUpdateFlashSale = hasPermission(
    Resource.PROMO_FLASH_SALES,
    Action.UPDATE,
  );
  const canDeleteFlashSale = hasPermission(
    Resource.PROMO_FLASH_SALES,
    Action.DELETE,
  );
  // Bật/tắt dùng quyền CHANGE_STATUS (giữ tên biến để không ảnh hưởng nơi khác)
  const canPublishFlashSale = hasPermission(
    Resource.PROMO_FLASH_SALES,
    Action.CHANGE_STATUS,
  );

  const canCreateCombo = hasPermission(Resource.PROMO_COMBOS, Action.CREATE);
  const canUpdateCombo = hasPermission(Resource.PROMO_COMBOS, Action.UPDATE);
  const canDeleteCombo = hasPermission(Resource.PROMO_COMBOS, Action.DELETE);
  const canPublishCombo = hasPermission(
    Resource.PROMO_COMBOS,
    Action.CHANGE_STATUS,
  );

  const fetchPromotions = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. CORE API (Bắt buộc): Lấy danh sách Flash Sale & Combo
      // Nếu user không có quyền xem 2 cái này, nó sẽ văng thẳng xuống block catch bự ở dưới cùng.
      const [fsRes, cbRes] = await Promise.all([
        axiosClient.get("/promotions/flash-sales?limit=1000"),
        axiosClient.get("/promotions/combos"),
      ]);

      // 2. AUXILIARY API (API Phụ): Nuốt lỗi âm thầm
      // Chỉ cần trả về cấu trúc Object rỗng ({ data: { data: [] } }), TUYỆT ĐỐI KHÔNG DÙNG toast.error() ở đây.
      const [prodRes, catRes, tagRes] = await Promise.all([
        axiosClient
          .get("/products?limit=1000")
          .catch(() => ({ data: { data: [] } })),
        axiosClient
          .get("/categories/admin/tree-view")
          .catch(() => ({ data: { data: [] } })),
        axiosClient
          .get("/tags?limit=1000")
          .catch(() => ({ data: { data: [] } })),
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
      // Nơi này chỉ nổ Toast nếu API Flash Sale / Combo thất bại (ví dụ lỗi 403 do quyền)
      toast.error(
        extractErrorMessage(error, "Không thể tải danh sách khuyến mãi!"),
      );
    } finally {
      setIsLoading(false);
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

    // --- FIX: ÁP DỤNG CỜ QUYỀN VÀO ACTIONS MODAL ---
    openAddModal: () => {
      if (!canCreateFlashSale && !canCreateCombo) {
        return toast.error(
          "Bạn không có quyền tạo chương trình khuyến mãi nào.",
        );
      }
      setModalConfig({
        isOpen: true,
        mode: "add",
        editingRecord: null,
        isSubmitting: false,
      });
    },
    openEditModal: (record: PromotionRecord) => {
      if (record.type === "Flash Sale" && !canUpdateFlashSale) {
        return toast.error("Bạn không có quyền sửa Flash Sale.");
      }
      if (record.type === "Discount" && !canUpdateCombo) {
        return toast.error("Bạn không có quyền sửa Combo Deals.");
      }
      setModalConfig({
        isOpen: true,
        mode: "edit",
        editingRecord: record,
        isSubmitting: false,
      });
    },
    openViewModal: (record: PromotionRecord) =>
      setModalConfig({
        isOpen: true,
        mode: "view",
        editingRecord: record,
        isSubmitting: false,
      }),
    openDeleteModal: (record?: PromotionRecord) => {
      if (record) {
        if (record.type === "Flash Sale" && !canDeleteFlashSale) {
          return toast.error("Bạn không có quyền xóa Flash Sale.");
        }
        if (record.type === "Discount" && !canDeleteCombo) {
          return toast.error("Bạn không có quyền xóa Combo Deals.");
        }
      } else {
        // Nếu mở xóa bulk, sẽ check quyền trong handleConfirmDelete hoặc bulkDelete function
      }
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

          const requests = [];
          if (fsIds.length > 0) {
            requests.push(
              axiosClient.post("/promotions/flash-sales/bulk/delete", {
                ids: fsIds,
              }),
            );
          }
          if (cbIds.length > 0) {
            requests.push(
              axiosClient.post("/promotions/combos/bulk/delete", {
                ids: cbIds,
              }),
            );
          }

          await Promise.all(requests);
          toast.success("Xóa hàng loạt thành công!");
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

    if (record.type === "Flash Sale" && !canPublishFlashSale) {
      return toast.error("Bạn không có quyền bật/tắt Flash Sale.");
    }
    if (record.type === "Discount" && !canPublishCombo) {
      return toast.error("Bạn không có quyền bật/tắt Combo Deals.");
    }

    // Đang bật = Active hoặc Scheduled. Bật/tắt đi qua bulk/status (quyền CHANGE_STATUS)
    const isOn = currentStatus === "Active" || currentStatus === "Scheduled";
    const endpoint =
      record.type === "Flash Sale"
        ? "/promotions/flash-sales/bulk/status"
        : "/promotions/combos/bulk/status";

    try {
      const res = await axiosClient.patch(endpoint, {
        ids: [id],
        action: isOn ? "DEACTIVATE" : "ACTIVATE",
      });
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
      const isFlashSale = data.type === "Flash Sale";
      const canToggle = isFlashSale ? canPublishFlashSale : canPublishCombo;
      const base = isFlashSale
        ? "/promotions/flash-sales"
        : "/promotions/combos";

      // Bật = Published (Active/Scheduled); Draft/Inactive = tắt
      const wantOn = data.status !== "Draft" && data.status !== "Inactive";
      const wasOn =
        mode === "edit" && editingRecord
          ? editingRecord.status === "Active" ||
            editingRecord.status === "Scheduled"
          : false;

      // KHÔNG gửi status: bật/tắt đi qua bulk/status (quyền CHANGE_STATUS)
      const payload: Record<
        string,
        string | number | boolean | string[] | undefined
      > = {
        name: data.name.trim(),
        description: data.description,
        applicable_scope_type: data.applicableScopeType,
        applicable_scope_values: data.applicableScopeValues,
      };

      if (isFlashSale) {
        payload.discount_type =
          data.discountType === "%" ? "PERCENTAGE" : "FIXED_PRICE";
        payload.discount_value = Number(data.discountValueNum);
        payload.start_time = sDate.toISOString();
        payload.end_time = eDate.toISOString();
      } else {
        payload.type = "DIRECT_DISCOUNT";
        payload.is_percent = data.discountType === "%";
        payload.discount_value = Number(data.discountValueNum);
        payload.start_date = sDate.toISOString();
        payload.end_date = eDate.toISOString();
        payload.min_quantity = 1;
      }

      let statusNote = "";
      const changeStatus = async (
        id: string,
        action: "ACTIVATE" | "DEACTIVATE",
      ) => {
        if (!canToggle) {
          statusNote =
            " Bạn không có quyền bật/tắt nên trạng thái được giữ nguyên.";
          return;
        }
        const res = await axiosClient.patch(`${base}/bulk/status`, {
          ids: [id],
          action,
        });
        // Flash Sale bị trùng lịch sẽ được BE báo "Bỏ qua ..."
        const msg: string = res.data?.message || "";
        if (msg.includes("Bỏ qua")) statusNote = ` ${msg}`;
      };

      if (mode === "add") {
        const res = await axiosClient.post(base, payload);
        const newId: string | undefined = res.data?.data?._id;
        if (wantOn && newId) await changeStatus(newId, "ACTIVATE");
      } else if (editingRecord) {
        // Tắt TRƯỚC khi sửa (BE chỉ cho sửa thông tin cốt lõi khi chương trình đã tắt)
        if (wasOn && !wantOn)
          await changeStatus(editingRecord.id, "DEACTIVATE");
        await axiosClient.patch(`${base}/${editingRecord.id}`, payload);
        // Bật SAU khi sửa
        if (!wasOn && wantOn) await changeStatus(editingRecord.id, "ACTIVATE");
      }

      const baseMsg =
        mode === "add" ? "Thêm khuyến mãi thành công!" : "Cập nhật thành công!";
      if (statusNote) toast.warning(baseMsg + statusNote);
      else toast.success(baseMsg);
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

        if (fsIds.length === 0 && cbIds.length === 0) return;

        // --- FIX: CHẶN TỪNG LOẠI TRONG BULK ACTIONS ---
        if (fsIds.length > 0 && !canPublishFlashSale) {
          return toast.error("Bạn không có quyền kích hoạt Flash Sale.");
        }
        if (cbIds.length > 0 && !canPublishCombo) {
          return toast.error("Bạn không có quyền kích hoạt Combo Deals.");
        }

        const requests = [];
        if (fsIds.length > 0) {
          requests.push(
            axiosClient.patch("/promotions/flash-sales/bulk/status", {
              ids: fsIds,
              action: "ACTIVATE",
            }),
          );
        }
        if (cbIds.length > 0) {
          requests.push(
            axiosClient.patch("/promotions/combos/bulk/status", {
              ids: cbIds,
              action: "ACTIVATE",
            }),
          );
        }

        await Promise.all(requests);

        toast.success(`Đã kích hoạt các khuyến mãi được chọn!`);
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

        if (fsIds.length === 0 && cbIds.length === 0) return;

        // --- FIX: CHẶN TỪNG LOẠI TRONG BULK ACTIONS ---
        if (fsIds.length > 0 && !canPublishFlashSale) {
          return toast.error("Bạn không có quyền vô hiệu hóa Flash Sale.");
        }
        if (cbIds.length > 0 && !canPublishCombo) {
          return toast.error("Bạn không có quyền vô hiệu hóa Combo Deals.");
        }

        const requests = [];
        if (fsIds.length > 0) {
          requests.push(
            axiosClient.patch("/promotions/flash-sales/bulk/status", {
              ids: fsIds,
              action: "DEACTIVATE",
            }),
          );
        }
        if (cbIds.length > 0) {
          requests.push(
            axiosClient.patch("/promotions/combos/bulk/status", {
              ids: cbIds,
              action: "DEACTIVATE",
            }),
          );
        }

        await Promise.all(requests);

        toast.success(`Đã vô hiệu hóa khuyến mãi được chọn!`);
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
      const fsIds = Array.from(selectedIds).filter(
        (id) => records.find((r) => r.id === id)?.type === "Flash Sale",
      );
      const cbIds = Array.from(selectedIds).filter(
        (id) => records.find((r) => r.id === id)?.type === "Discount",
      );

      // --- FIX: CHẶN TỪNG LOẠI TRONG BULK ACTIONS ---
      if (fsIds.length > 0 && !canDeleteFlashSale) {
        return toast.error("Bạn không có quyền xóa hàng loạt Flash Sale.");
      }
      if (cbIds.length > 0 && !canDeleteCombo) {
        return toast.error("Bạn không có quyền xóa hàng loạt Combo Deals.");
      }

      actions.openDeleteModal();
    },
  };

  return {
    currentRecords,
    isLoading,
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
    // Trả về cờ để Frontend Component dùng ẩn/hiện nút bấm
    permissions: {
      canCreateFlashSale,
      canUpdateFlashSale,
      canDeleteFlashSale,
      canPublishFlashSale,
      canCreateCombo,
      canUpdateCombo,
      canDeleteCombo,
      canPublishCombo,
    },
  };
}
