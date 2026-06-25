import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

export type CustomerStatus = "Active" | "Inactive" | "Locked" | "Deleted";
export type CustomerType = "Bronze" | "Silver" | "Gold" | "Platinum";
export type ReviewAccessStatus = "Allowed" | "Restricted";

export interface CustomerRecord {
  id: string;
  fullName: string;
  email: string;
  username: string;
  customerType: CustomerType;
  status: CustomerStatus;
  reviewAccess: ReviewAccessStatus;
  lastLogin: string;
  phone: string;
  loyalty: {
    total_spent: number;
    point: number;
  };
}

export interface CustomerFormData {
  fullName: string;
  email: string;
  username: string;
  password?: string;
  customerType: CustomerType;
  phone: string;
  status: CustomerStatus;
  reviewAccess: ReviewAccessStatus;
}

interface BackendCustomerResponse {
  _id: string;
  first_Name: string;
  last_Name: string;
  email: string;
  username?: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DELETED";
  loyalty?: {
    tier: string;
    total_spent?: number;
    point?: number;
  };
  review_access: "ALLOWED" | "RESTRICTED";
  last_login_at?: string;
}

type StatusActionPayload =
  | { type: "TOGGLE"; id: string; currentStatus: CustomerStatus }
  | { type: "LOCK_UNLOCK"; id: string; currentStatus: CustomerStatus }
  | { type: "BULK_ACTIVATE" }
  | { type: "BULK_DEACTIVATE" }
  | { type: "DELETE"; id: string; name: string }
  | { type: "BULK_DELETE" };

const mapStatusToFE = (beStatus: string): CustomerStatus => {
  if (beStatus === "ACTIVE") return "Active";
  if (beStatus === "INACTIVE") return "Inactive";
  if (beStatus === "DELETED") return "Deleted";
  return "Locked"; // Dành cho SUSPENDED
};

const mapStatusToBE = (feStatus: CustomerStatus): string => {
  if (feStatus === "Active") return "ACTIVE";
  if (feStatus === "Inactive") return "INACTIVE";
  if (feStatus === "Deleted") return "DELETED";
  return "SUSPENDED"; // Thay SUSPENDED thành SUSPENDED để khớp với Backend
};

const mapTypeToBE = (feType: CustomerType): string => {
  if (feType === "Bronze") return "BRONZE";
  if (feType === "Silver") return "SILVER";
  if (feType === "Gold") return "GOLD";
  if (feType === "Platinum") return "PLATINUM";
  return "BRONZE"; // Fallback an toàn
};

const mapBEToType = (beTier?: string): CustomerType => {
  switch (beTier) {
    case "BRONZE":
      return "Bronze";
    case "SILVER":
      return "Silver";
    case "GOLD":
      return "Gold";
    case "PLATINUM":
      return "Platinum";
    default:
      return "Bronze"; // Khách hàng mới mặc định là Bronze
  }
};

export function useCustomerManagement() {
  const [records, setRecords] = useState<CustomerRecord[]>([]);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "All">(
    "All",
  );
  const [typeFilter, setTypeFilter] = useState<CustomerType | "All">("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [totalFiltered, setTotalFiltered] = useState<number>(0);

  const [reasonModal, setReasonModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    payload: StatusActionPayload | null;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    title: "",
    description: "",
    payload: null,
    isSubmitting: false,
  });

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit" | "view";
    editingRecord: CustomerRecord | null;
    isSubmitting: boolean;
  }>({ isOpen: false, mode: "add", editingRecord: null, isSubmitting: false });

  const fetchCustomers = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (search.trim()) queryParams.append("keyword", search.trim());
      if (statusFilter !== "All")
        queryParams.append("status", mapStatusToBE(statusFilter));
      if (typeFilter !== "All")
        queryParams.append("tier", mapTypeToBE(typeFilter));

      const response = await axiosClient.get(
        `/admin/customers?${queryParams.toString()}`,
      );

      const data = response.data.data;
      const meta = response.data.meta;

      const mappedRecords: CustomerRecord[] = data.map(
        (item: BackendCustomerResponse) => ({
          id: item._id,
          fullName:
            `${item.last_Name || ""} ${item.first_Name || ""}`.trim() ||
            item.email.split("@")[0],
          email: item.email,
          username: item.username || item.email.split("@")[0],
          customerType: mapBEToType(item.loyalty?.tier),
          status: mapStatusToFE(item.status),
          reviewAccess:
            item.review_access === "RESTRICTED" ? "Restricted" : "Allowed",
          lastLogin: item.last_login_at
            ? new Date(item.last_login_at).toLocaleString()
            : "Never",
          phone: item.phone || "N/A",
          loyalty: {
            total_spent: item.loyalty?.total_spent || 0,
            point: item.loyalty?.point || 0,
          },
        }),
      );

      setRecords(mappedRecords);
      setTotalFiltered(meta.total);
    } catch (error) {
      toast.error("Không thể tải danh sách khách hàng từ hệ thống.");
      console.error("Fetch Error:", error);
    }
  }, [pagination.page, pagination.limit, search, statusFilter, typeFilter]);

  const isModalOpenRef = useRef(false);

  useEffect(() => {
    isModalOpenRef.current = modalConfig.isOpen;
  }, [modalConfig.isOpen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCustomers();
  }, [fetchCustomers]);

  const totalPages = Math.ceil(totalFiltered / pagination.limit);
  const startIndex = (pagination.page - 1) * pagination.limit;

  const actions = {
    changeSearch: (val: string) => {
      if (isModalOpenRef.current) return;
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
        records.forEach((r) => {
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

    // GỌI THẲNG STATUS REASON MODAL CHO HÀNH ĐỘNG DELETE
    openDeleteModal: (record?: CustomerRecord) => {
      if (record) {
        setReasonModal({
          isOpen: true,
          title: "Delete Account",
          description: `Are you sure you want to delete customer "${record.fullName}"? Please provide a reason for the system audit log.`,
          payload: { type: "DELETE", id: record.id, name: record.fullName },
          isSubmitting: false,
        });
      } else {
        setReasonModal({
          isOpen: true,
          title: "Bulk Delete Accounts",
          description: `You have selected to delete ${selectedIds.size} customer account(s). Please provide a reason for the system audit log.`,
          payload: { type: "BULK_DELETE" },
          isSubmitting: false,
        });
      }
    },

    closeModal: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),

    lockUnlockCustomer: (id: string, currentStatus: CustomerStatus) => {
      setReasonModal({
        isOpen: true,
        title:
          currentStatus === "Locked"
            ? "Unlock Account Confirmation"
            : "Lock Account Confirmation",
        description: `You are performing an ${
          currentStatus === "Locked" ? "unlock" : "lock/suspension"
        } action on this account. Please provide a reason for the system audit log.`,
        payload: { type: "LOCK_UNLOCK", id, currentStatus },
        isSubmitting: false,
      });
    },

    exportExcel: async () => {
      try {
        toast.info("Đang xử lý xuất dữ liệu, vui lòng đợi...");

        // 1. Lấy thông tin phân trang và bộ lọc hiện tại
        const queryParams = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
        });

        if (search.trim()) queryParams.append("keyword", search.trim());
        if (statusFilter !== "All")
          queryParams.append("status", mapStatusToBE(statusFilter));
        if (typeFilter !== "All")
          queryParams.append("tier", mapTypeToBE(typeFilter));

        // 2. Gắn chuỗi query vào API
        const response = await axiosClient.get(
          `/admin/customers/export/excel?${queryParams.toString()}`,
          {
            responseType: "blob",
          },
        );

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `Bao_Cao_Khach_Hang_${new Date().getTime()}.xlsx`,
        );
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success("Xuất dữ liệu thành công!");
      } catch (error: unknown) {
        const err = error as { message?: string };
        toast.error(err.message || "Xuất dữ liệu thất bại.");
      }
    },
  };

  const toggleRowStatus = (id: string, currentStatus: CustomerStatus) => {
    if (currentStatus === "Locked") {
      toast.warning("Tài khoản đang bị khóa, hãy dùng chức năng Unlock.");
      return;
    }
    setReasonModal({
      isOpen: true,
      title:
        currentStatus === "Active" ? "Deactivate Account" : "Activate Account",
      description: `You are changing this customer account status to ${
        currentStatus === "Active" ? "Inactive" : "Active"
      }.`,
      payload: { type: "TOGGLE", id, currentStatus },
      isSubmitting: false,
    });
  };

  const handleModalSubmit = async (data: CustomerFormData) => {
    setModalConfig((prev) => ({ ...prev, isSubmitting: true }));
    try {
      let cleanPhone = data.phone.replace(/\D/g, "");
      if (cleanPhone.startsWith("84")) {
        cleanPhone = "0" + cleanPhone.slice(2);
      }

      const nameParts = data.fullName.trim().split(" ");
      const lastName = nameParts[0];
      const firstName =
        nameParts.length > 1 ? nameParts.slice(1).join(" ") : lastName;

      if (modalConfig.mode === "add") {
        await axiosClient.post("/admin/customers", {
          firstName: firstName,
          lastName: lastName,
          username: data.username,
          email: data.email,
          phone: cleanPhone,
          tempPassword: data.password || "Odyssey@2026!",
        });
        toast.success("Thêm khách hàng thành công!");
      } else if (modalConfig.mode === "edit" && modalConfig.editingRecord) {
        await axiosClient.patch(
          `/admin/customers/${modalConfig.editingRecord.id}`,
          {
            first_Name: firstName,
            last_Name: lastName,
            email: data.email,
            username: data.username,
            phone: cleanPhone,
            loyaltyTier: mapTypeToBE(data.customerType),
          },
        );

        const oldAccess = modalConfig.editingRecord.reviewAccess;
        if (data.reviewAccess !== oldAccess) {
          await axiosClient.patch(
            `/admin/customers/${modalConfig.editingRecord.id}/review-access`,
            {
              access:
                data.reviewAccess === "Allowed" ? "ALLOWED" : "RESTRICTED",
              reason: "Admin cập nhật quyền qua Modal",
            },
          );
        }
        if (data.password && data.password.trim()) {
          await axiosClient.patch(
            `/admin/customers/${modalConfig.editingRecord.id}/password`,
            { newPassword: data.password.trim() },
          );
        }
        toast.success("Cập nhật thông tin thành công!");
      }
      actions.closeModal();
      fetchCustomers();
    } catch (error: unknown) {
      const getErrorMessage = (err: unknown): string => {
        if (typeof err === "string") return err;
        if (typeof err === "object" && err !== null) {
          const messageField = (err as { message?: unknown }).message;
          if (Array.isArray(messageField))
            return messageField[0] ?? "Lỗi hệ thống khi lưu dữ liệu.";
          if (typeof messageField === "string") return messageField;
        }
        return "Lỗi hệ thống khi lưu dữ liệu.";
      };

      const errorMsg = getErrorMessage(error);
      toast.error(errorMsg);
      setModalConfig((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const bulkActions = {
    bulkActivate: () => {
      if (selectedIds.size === 0) return;
      setReasonModal({
        isOpen: true,
        title: "Bulk Activate Accounts",
        description: `You have selected to activate ${selectedIds.size} customer account(s).`,
        payload: { type: "BULK_ACTIVATE" },
        isSubmitting: false,
      });
    },
    bulkDeactivate: () => {
      if (selectedIds.size === 0) return;
      setReasonModal({
        isOpen: true,
        title: "Bulk Deactivate Accounts",
        description: `You have selected to deactivate ${selectedIds.size} customer account(s).`,
        payload: { type: "BULK_DEACTIVATE" },
        isSubmitting: false,
      });
    },
    bulkDelete: () => {
      if (selectedIds.size === 0) return;
      actions.openDeleteModal();
    },
  };

  const handleReasonSubmit = async (reason: string) => {
    if (!reasonModal.payload) return;
    setReasonModal((prev) => ({ ...prev, isSubmitting: true }));

    try {
      const payload = reasonModal.payload;

      switch (payload.type) {
        case "TOGGLE": {
          const targetStatus =
            payload.currentStatus === "Active" ? "INACTIVE" : "ACTIVE";
          await axiosClient.patch(`/admin/customers/${payload.id}/status`, {
            status: targetStatus,
            reason,
          });
          toast.success("Cập nhật trạng thái thành công!");
          break;
        }
        case "LOCK_UNLOCK": {
          const targetStatus =
            payload.currentStatus === "Locked" ? "ACTIVE" : "SUSPENDED";
          await axiosClient.patch(`/admin/customers/${payload.id}/status`, {
            status: targetStatus,
            reason,
          });
          toast.success(
            `Đã ${payload.currentStatus === "Locked" ? "mở khóa" : "khóa"} tài khoản thành công!`,
          );
          break;
        }
        case "BULK_ACTIVATE": {
          await axiosClient.patch(`/admin/customers/bulk/status`, {
            customerIds: Array.from(selectedIds),
            status: "ACTIVE",
            reason,
          });
          toast.success("Kích hoạt hàng loạt thành công!");
          setSelectedIds(new Set());
          break;
        }
        case "BULK_DEACTIVATE": {
          await axiosClient.patch(`/admin/customers/bulk/status`, {
            customerIds: Array.from(selectedIds),
            status: "INACTIVE",
            reason,
          });
          toast.warning("Vô hiệu hóa hàng loạt thành công!");
          setSelectedIds(new Set());
          break;
        }
        case "DELETE": {
          await axiosClient.delete(`/admin/customers/${payload.id}`, {
            data: { reason },
          });
          toast.success(`Đã xóa tài khoản "${payload.name}" thành công!`);
          break;
        }
        case "BULK_DELETE": {
          await axiosClient.delete(`/admin/customers/bulk/delete`, {
            data: {
              customerIds: Array.from(selectedIds),
              reason,
            },
          });
          toast.success("Đã xóa các tài khoản được chọn!");
          setSelectedIds(new Set());
          break;
        }
      }
      setReasonModal((prev) => ({ ...prev, isOpen: false }));
      fetchCustomers();
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Thao tác thất bại. Vui lòng thử lại.");
      setReasonModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  return {
    currentRecords: records,
    pagination: {
      ...pagination,
      totalPages,
      totalFiltered,
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
    reasonModal,
    handleReasonSubmit,
    closeReasonModal: () =>
      setReasonModal((prev) => ({ ...prev, isOpen: false })),
  };
}
