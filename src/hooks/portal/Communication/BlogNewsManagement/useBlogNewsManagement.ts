import { useState, useMemo } from "react";

// trạng thái tối giản theo hệ thống
export type BlogNewsStatus = "Published" | "Draft" | "Hidden";

// danh sách các danh mục đang hoạt động (dùng cho dropdown)
export const ACTIVE_CATEGORIES = [
  "Fashion",
  "Technology",
  "Lifestyle",
  "Tips & Tricks",
  "News",
];

export interface BlogNewsRecord {
  id: string;
  title: string;
  slug: string;
  category: string;
  author: string;
  status: BlogNewsStatus;
  publishDate: string; // hệ thống tự sinh
  featuredImage: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  attachedProducts: string[]; // danh sách ID sản phẩm đính kèm
}

export interface BlogNewsFormData {
  title: string;
  slug: string;
  category: string;
  status: BlogNewsStatus;
  featuredImage: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  attachedProducts: string[];
}

export const generateSlug = (title: string) => {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
};

const INITIAL_POSTS: BlogNewsRecord[] = [
  {
    id: "1",
    title: "Top 10 Fashion Trends in 2026",
    slug: "top-10-fashion-trends-2026",
    category: "Fashion",
    author: "Jane Doe",
    status: "Published",
    publishDate: "2026-04-06",
    featuredImage: "https://placehold.co/600x400/e0f2fe/0284c7?text=Mock+Image",
    content: "<p>Welcome to the latest fashion trends...</p>",
    metaTitle: "Top 10 Fashion Trends in 2026 | H&N Odyssey",
    metaDescription:
      "Explore the most popular fashion trends for 2026. This will be used as the short description.",
    attachedProducts: ["p1", "p2"],
  },
];

export function useBlogNewsManagement() {
  const [records, setRecords] = useState<BlogNewsRecord[]>(INITIAL_POSTS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BlogNewsStatus | "All">(
    "All",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [drawerConfig, setDrawerConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit" | "view";
    editingRecord: BlogNewsRecord | null;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    mode: "add",
    editingRecord: null,
    isSubmitting: false,
  });

  const [deleteModalConfig, setDeleteModalConfig] = useState<{
    isOpen: boolean;
    targetId?: string;
    isBulk: boolean;
  }>({
    isOpen: false,
    isBulk: false,
  });

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.category.toLowerCase().includes(search.toLowerCase()) ||
        r.author.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "All" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [records, search, statusFilter]);

  const totalPages = Math.ceil(filteredRecords.length / limit);
  const startIndex = (page - 1) * limit;
  const paginatedRecords = filteredRecords.slice(
    startIndex,
    startIndex + limit,
  );

  const changeSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };
  const changeStatusFilter = (status: BlogNewsStatus | "All") => {
    setStatusFilter(status);
    setPage(1);
  };
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setPage(1);
  };
  const changePage = (p: number) => setPage(p);
  const changeLimit = (l: number) => {
    setLimit(l);
    setPage(1);
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };
  const toggleSelectAll = (isAll: boolean) => {
    if (isAll) setSelectedIds(new Set(paginatedRecords.map((r) => r.id)));
    else setSelectedIds(new Set());
  };

  const openAddDrawer = () =>
    setDrawerConfig({
      isOpen: true,
      mode: "add",
      editingRecord: null,
      isSubmitting: false,
    });
  const openEditDrawer = (record: BlogNewsRecord) =>
    setDrawerConfig({
      isOpen: true,
      mode: "edit",
      editingRecord: record,
      isSubmitting: false,
    });
  const openViewDrawer = (record: BlogNewsRecord) =>
    setDrawerConfig({
      isOpen: true,
      mode: "view",
      editingRecord: record,
      isSubmitting: false,
    });
  const closeDrawer = () =>
    setDrawerConfig((prev) => ({ ...prev, isOpen: false }));

  const handleDrawerSubmit = (data: BlogNewsFormData) => {
    setDrawerConfig((prev) => ({ ...prev, isSubmitting: true }));

    // giả lập gọi api lưu dữ liệu
    setTimeout(() => {
      if (drawerConfig.mode === "add") {
        const newRecord: BlogNewsRecord = {
          ...data,
          id: Date.now().toString(),
          author: "Current User", // lấy từ context người dùng đang đăng nhập
          publishDate: new Date().toISOString().split("T")[0],
        };
        setRecords([newRecord, ...records]);
      } else if (drawerConfig.mode === "edit" && drawerConfig.editingRecord) {
        setRecords(
          records.map((r) =>
            r.id === drawerConfig.editingRecord!.id ? { ...r, ...data } : r,
          ),
        );
      }
      setDrawerConfig((prev) => ({
        ...prev,
        isOpen: false,
        isSubmitting: false,
      }));
    }, 600);
  };

  const openDeleteModal = (id?: string) => {
    if (id) setDeleteModalConfig({ isOpen: true, targetId: id, isBulk: false });
    else if (selectedIds.size > 0)
      setDeleteModalConfig({ isOpen: true, isBulk: true });
  };
  const closeDeleteModal = () =>
    setDeleteModalConfig({ isOpen: false, isBulk: false });

  const handleConfirmDelete = () => {
    if (deleteModalConfig.isBulk) {
      setRecords(records.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } else if (deleteModalConfig.targetId) {
      setRecords(records.filter((r) => r.id !== deleteModalConfig.targetId));
    }
    closeDeleteModal();
  };

  const bulkPublish = () => {
    setRecords(
      records.map((r) =>
        selectedIds.has(r.id) ? { ...r, status: "Published" } : r,
      ),
    );
    setSelectedIds(new Set());
  };
  const bulkHide = () => {
    setRecords(
      records.map((r) =>
        selectedIds.has(r.id) ? { ...r, status: "Hidden" } : r,
      ),
    );
    setSelectedIds(new Set());
  };
  const bulkDelete = () => openDeleteModal();

  return {
    records: paginatedRecords,
    pagination: {
      page,
      limit,
      totalPages,
      totalFiltered: filteredRecords.length,
      startIndex,
    },
    search,
    statusFilter,
    selectedIds,
    drawerConfig,
    deleteModalConfig,
    actions: {
      changeSearch,
      changeStatusFilter,
      clearFilters,
      changePage,
      changeLimit,
      toggleSelection,
      toggleSelectAll,
      openAddDrawer,
      openEditDrawer,
      openViewDrawer,
      closeDrawer,
      handleDrawerSubmit,
      openDeleteModal,
      closeDeleteModal,
      handleConfirmDelete,
    },
    bulkActions: { bulkPublish, bulkHide, bulkDelete },
  };
}
