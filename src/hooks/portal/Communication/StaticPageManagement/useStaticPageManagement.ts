import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient"; // <-- XEM LẠI ĐƯỜNG DẪN NÀY NẾU CẦN

export type PageStatus = "Published" | "Draft" | "Hidden";
export type PageType =
  | "About Us"
  | "Policy"
  | "FAQ"
  | "Contact"
  | "Guide"
  | "Promotion"
  | "Company News";

export interface StaticPageRecord {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  status: PageStatus;
  publishDate: string;
  content: string;
  lastSaved?: string;
  isSystem?: boolean;
  originalStatus?: "Published" | "Draft";
}

export interface StaticPageFormData {
  title: string;
  slug: string;
  type: PageType | "";
  content: string;
  status: PageStatus;
}

interface PageApiResponse {
  _id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;
  content: string;
  is_system: boolean;
}

export function useStaticPageManagement() {
  const [records, setRecords] = useState<StaticPageRecord[]>([]);
  const [totalFiltered, setTotalFiltered] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Filters & Pagination State
  const [search, setSearch] = useState<string>("");
  const [apiSearch, setApiSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<PageStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<PageType | "All">("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit" | "view" | "delete";
    editingRecord: StaticPageRecord | null;
    isSubmitting: boolean;
  }>({ isOpen: false, mode: "add", editingRecord: null, isSubmitting: false });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (apiSearch !== search) {
        setApiSearch(search);
        setPagination((p) => ({ ...p, page: 1 }));
        setSelectedIds(new Set());
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search, apiSearch]);

  const fetchPages = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axiosClient.get("/marketing/content/pages", {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          status:
            statusFilter !== "All" ? statusFilter.toUpperCase() : undefined,
          type: typeFilter !== "All" ? typeFilter : undefined,
          search: apiSearch || undefined,
        },
      });

      const { data, meta } = res.data.data;

      const formattedData: StaticPageRecord[] = data.map(
        (item: PageApiResponse) => {
          const formattedStatus = (item.status.charAt(0) +
            item.status.slice(1).toLowerCase()) as PageStatus;

          return {
            id: item._id,
            title: item.title,
            slug: item.slug,
            type: (item.type as PageType) || "About Us",
            status: formattedStatus,
            publishDate: new Date(item.created_at).toLocaleDateString("vi-VN"),
            content: item.content,
            isSystem: item.is_system,
            originalStatus: formattedStatus,
            lastSaved: new Date(item.updated_at).toLocaleDateString("vi-VN"),
          };
        },
      );

      setRecords(formattedData);
      setTotalFiltered(meta.totalItems);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Lỗi khi tải danh sách trang tĩnh");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, typeFilter, apiSearch]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const totalPages = Math.ceil(totalFiltered / pagination.limit);
  const startIndex = (pagination.page - 1) * pagination.limit;

  // 3. CÁC HÀM XỬ LÝ (ACTIONS)
  const actions = {
    changeSearch: (val: string) => {
      setSearch(val);
    },
    changeStatusFilter: (status: PageStatus | "All") => {
      setStatusFilter(status);
      setSelectedIds(new Set());
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changeTypeFilter: (type: PageType | "All") => {
      setTypeFilter(type);
      setSelectedIds(new Set());
      setPagination((p) => ({ ...p, page: 1 }));
    },
    clearFilters: () => {
      setSearch("");
      setApiSearch("");
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
        records.forEach((r) => {
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
    openEditModal: (record: StaticPageRecord) =>
      setModalConfig({
        isOpen: true,
        mode: "edit",
        editingRecord: record,
        isSubmitting: false,
      }),
    openViewModal: (record: StaticPageRecord) =>
      setModalConfig({
        isOpen: true,
        mode: "view",
        editingRecord: record,
        isSubmitting: false,
      }),
    openDeleteModal: (record?: StaticPageRecord) => {
      if (record && record.isSystem) {
        toast.error("Không thể xóa trang hệ thống mặc định.");
        return;
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

    toggleHiddenStatus: async (id: string) => {
      const record = records.find((r) => r.id === id);
      if (!record) return;

      const targetStatus = record.status === "Hidden" ? "DRAFT" : "HIDDEN";

      try {
        await axiosClient.patch(`/marketing/content/pages/${id}`, {
          status: targetStatus,
        });
        toast.success("Cập nhật trạng thái hiển thị thành công!");
        fetchPages();
      } catch (error: unknown) {
        const err = error as { message?: string };
        toast.error(err.message || "Lỗi khi cập nhật trạng thái");
      }
    },

    handleConfirmDelete: async () => {
      try {
        if (modalConfig.editingRecord) {
          await axiosClient.delete(
            `/marketing/content/pages/${modalConfig.editingRecord.id}`,
          );
          toast.success("Đã xóa trang tĩnh thành công!");
        } else {
          const targets = records.filter(
            (r) => selectedIds.has(r.id) && !r.isSystem,
          );
          if (targets.length < selectedIds.size) {
            toast.warning(
              "Các trang hệ thống trong danh sách chọn đã được giữ lại.",
            );
          }
          await Promise.all(
            targets.map((t) =>
              axiosClient.delete(`/marketing/content/pages/${t.id}`),
            ),
          );
          toast.success(`Đã xóa ${targets.length} trang tĩnh thành công!`);
        }
        setSelectedIds(new Set());
        fetchPages();
        actions.closeModal();
      } catch (error: unknown) {
        const err = error as { message?: string };
        toast.error(err.message || "Xóa thất bại!");
      }
    },
  };

  // 4. GỬI FORM (CREATE / UPDATE)
  const handleModalSubmit = async (data: StaticPageFormData) => {
    const { mode, editingRecord } = modalConfig;

    if (!data.title.trim()) return toast.error("Vui lòng nhập tiêu đề trang.");
    if (!data.slug.trim()) return toast.error("Vui lòng nhập URL / Slug.");
    if (!data.type) return toast.error("Vui lòng chọn loại trang (Page Type).");
    if (!data.content.trim())
      return toast.error("Vui lòng nhập Nội dung trang.");

    try {
      setModalConfig((prev) => ({ ...prev, isSubmitting: true }));

      const payload = {
        title: data.title.trim(),
        slug: data.slug.trim().replace(/^\/+/, "").replace(/\/+$/, ""),
        type: data.type,
        content: data.content,
        status: data.status.toUpperCase(),
      };

      if (mode === "add") {
        await axiosClient.post("/marketing/content/pages", payload);
        toast.success("Tạo trang tĩnh thành công!");
      } else if (mode === "edit" && editingRecord) {
        await axiosClient.patch(
          `/marketing/content/pages/${editingRecord.id}`,
          payload,
        );
        toast.success("Cập nhật trang tĩnh thành công!");
      }

      fetchPages();
      actions.closeModal();
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Lưu dữ liệu thất bại.");
    } finally {
      setModalConfig((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const bulkActions = {
    bulkActivate: async () => {
      const targets = records.filter(
        (r) => selectedIds.has(r.id) && r.status !== "Published",
      );
      if (targets.length === 0) return;
      try {
        await Promise.all(
          targets.map((t) =>
            axiosClient.patch(`/marketing/content/pages/${t.id}`, {
              status: "PUBLISHED",
            }),
          ),
        );
        toast.success(`Đã xuất bản ${targets.length} trang!`);
        setSelectedIds(new Set());
        fetchPages();
      } catch (error: unknown) {
        const err = error as { message?: string };
        toast.error(err.message || "Lỗi khi xuất bản hàng loạt");
      }
    },
    bulkDelete: () => {
      if (selectedIds.size === 0) return;
      const targets = records.filter(
        (r) => selectedIds.has(r.id) && !r.isSystem,
      );
      if (targets.length === 0) {
        toast.error(
          "Các trang được chọn đều là trang hệ thống, không thể xóa.",
        );
        return;
      }
      actions.openDeleteModal();
    },
  };

  return {
    currentRecords: records,
    isLoading,
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
    handleModalSubmit,
    bulkActions,
  };
}
