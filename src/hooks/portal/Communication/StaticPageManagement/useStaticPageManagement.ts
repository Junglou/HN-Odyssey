import { useState, useRef, useMemo } from "react";
import { toast } from "react-toastify";

// định nghĩa các kiểu dữ liệu dựa trên hình ảnh thiết kế
export type PageStatus = "Published" | "Draft" | "Hidden";
export type PageType =
  | "About Us"
  | "Policy"
  | "FAQ"
  | "Contact"
  | "Guide"
  | "Promotion"
  | "Company News";

// cấu trúc dữ liệu hiển thị trên bảng
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

// cấu trúc dữ liệu dùng cho form tạo/sửa
export interface StaticPageFormData {
  title: string;
  slug: string;
  type: PageType | "";
  content: string;
  status: PageStatus;
}

// mock data chuẩn xác theo hình ảnh
const INITIAL_PAGES: StaticPageRecord[] = [
  {
    id: "1",
    title: "About Us",
    slug: "/about-us",
    type: "Promotion",
    status: "Published",
    publishDate: "01/06/2024",
    content: "Our story begins in...",
    lastSaved: "Nov 01, 11:45",
    isSystem: true, // trang hệ thống cốt lõi
  },
  {
    id: "2",
    title: "Privacy Policy",
    slug: "/privacy-policy",
    type: "Company News",
    status: "Published",
    publishDate: "01/01/2024",
    content:
      "Our privacy policy outlines how we collect, use, and protect your personal information. We control smil contents perneres and restanding and contracts to penees themo...",
    lastSaved: "Nov 01, 11:45",
    isSystem: true, // trang hệ thống cốt lõi
  },
  {
    id: "3",
    title: "Shipping Information",
    slug: "/shipping-info",
    type: "Promotion",
    status: "Draft",
    publishDate: "15/11/2024",
    content: "We offer worldwide shipping...",
  },
  {
    id: "4",
    title: "Contact Us",
    slug: "/contact-us",
    type: "Company News",
    status: "Hidden",
    publishDate: "01/03/2024",
    content: "Get in touch with our team...",
  },
  {
    id: "5",
    title: "Product Care Guide",
    slug: "/product-care",
    type: "Promotion",
    status: "Draft",
    publishDate: "01/08/2024",
    content: "How to take care of your products...",
  },
];

export function useStaticPageManagement() {
  const [records, setRecords] = useState<StaticPageRecord[]>(INITIAL_PAGES);
  const nextIdCounter = useRef<number>(6);

  // quản lý state bộ lọc và tìm kiếm
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<PageStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<PageType | "All">("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  // quản lý modal
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit" | "view" | "delete";
    editingRecord: StaticPageRecord | null;
    isSubmitting: boolean;
  }>({ isOpen: false, mode: "add", editingRecord: null, isSubmitting: false });

  // lọc dữ liệu
  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchStatus =
        statusFilter === "All" || record.status === statusFilter;
      const matchType = typeFilter === "All" || record.type === typeFilter;
      const matchSearch =
        !normalizedSearch ||
        record.title.toLowerCase().includes(normalizedSearch);

      return matchStatus && matchType && matchSearch;
    });
  }, [records, search, statusFilter, typeFilter]);

  // phân trang
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
      // kiểm tra nếu người dùng bấm nút xóa lẻ (hàng ngang) trên trang hệ thống
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

    toggleHiddenStatus: (id: string) => {
      setRecords((prev) =>
        prev.map((r) => {
          if (r.id === id) {
            if (r.status === "Hidden") {
              return { ...r, status: r.originalStatus || "Draft" };
            } else {
              return {
                ...r,
                status: "Hidden",
                originalStatus: r.status as "Published" | "Draft",
              };
            }
          }
          return r;
        }),
      );
    },

    handleConfirmDelete: () => {
      if (modalConfig.editingRecord) {
        const id = modalConfig.editingRecord.id;
        setRecords((prev) => prev.filter((r) => r.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.success("Đã xóa trang tĩnh thành công!");
      } else {
        // lọc ra các trang có thể xóa (bỏ qua trang hệ thống)
        const targets = records.filter(
          (r) => selectedIds.has(r.id) && !r.isSystem,
        );
        if (targets.length < selectedIds.size) {
          toast.warning(
            "Các trang hệ thống trong danh sách chọn đã được giữ lại.",
          );
        }

        const targetIds = new Set(targets.map((t) => t.id));
        setRecords((prev) => prev.filter((r) => !targetIds.has(r.id)));

        if (targets.length > 0) {
          toast.success(`Đã xóa ${targets.length} trang tĩnh thành công!`);
        }
        setSelectedIds(new Set());
      }
      setModalConfig((prev) => ({ ...prev, isOpen: false }));
    },
  };

  const handleModalSubmit = (data: StaticPageFormData) => {
    const { mode, editingRecord } = modalConfig;

    if (!data.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề trang.");
      return;
    }
    if (!data.slug.trim()) {
      toast.error("Vui lòng nhập URL / Slug.");
      return;
    }
    if (!data.type) {
      toast.error("Vui lòng chọn loại trang (Page Type).");
      return;
    }
    if (!data.content.trim()) {
      toast.error("Vui lòng nhập Nội dung trang.");
      return;
    }

    // kiểm tra trùng lặp slug (BR5)
    const isDuplicate = records.some(
      (r) => r.slug === data.slug && r.id !== editingRecord?.id,
    );
    if (isDuplicate) {
      toast.error("Đường dẫn (Slug) này đã tồn tại, vui lòng chọn tên khác.");
      return;
    }

    setModalConfig((prev) => ({ ...prev, isSubmitting: true }));

    setTimeout(() => {
      try {
        const today = new Date();
        const currentDateStr = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;

        if (mode === "add") {
          const newRecord: StaticPageRecord = {
            id: nextIdCounter.current.toString(),
            title: data.title.trim(),
            slug: data.slug.trim(),
            type: data.type as PageType,
            status: data.status,
            publishDate: currentDateStr,
            content: data.content,
            lastSaved: "Vừa xong",
            isSystem: false, // trang mới tạo không phải trang hệ thống
          };
          nextIdCounter.current += 1;
          setRecords((prev) => [newRecord, ...prev]);
          setPagination((p) => ({ ...p, page: 1 }));
          toast.success("Tạo trang tĩnh thành công!");
        } else if (mode === "edit" && editingRecord) {
          setRecords((prev) =>
            prev.map((r) =>
              r.id === editingRecord.id
                ? {
                    ...r,
                    title: data.title.trim(),
                    slug: data.slug.trim(),
                    type: data.type as PageType,
                    status: data.status,
                    content: data.content,
                    lastSaved: "Vừa xong",
                  }
                : r,
            ),
          );
          toast.success("Cập nhật trang tĩnh thành công!");
        }
        actions.closeModal();
      } catch {
        toast.error("Lưu dữ liệu thất bại.");
        setModalConfig((prev) => ({ ...prev, isSubmitting: false }));
      }
    }, 400);
  };

  const bulkActions = {
    bulkActivate: () => {
      const targets = records.filter(
        (r) => selectedIds.has(r.id) && r.status !== "Published",
      );
      if (targets.length === 0) return;
      setRecords((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id) ? { ...r, status: "Published" } : r,
        ),
      );
      toast.success(`Đã xuất bản ${targets.length} trang!`);
      setSelectedIds(new Set());
    },
    bulkDelete: () => {
      if (selectedIds.size === 0) return;

      // kiểm tra nếu người dùng chọn hàng loạt nhưng toàn trúng trang hệ thống
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
    handleModalSubmit,
    bulkActions,
  };
}
