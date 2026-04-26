import { useState, useMemo } from "react";
import { toast } from "react-toastify";

// Định nghĩa các kiểu dữ liệu cho trạng thái và vị trí
export type BannerStatus = "Active" | "Inactive" | "Pending";
export type BannerPosition = "Homepage Slider" | "Category" | "Promotion";
export type DrawerMode = "create" | "edit" | "view";

// Cấu trúc dữ liệu của một Banner trong hệ thống
export interface BannerRecord {
  id: string;
  name: string;
  imageDesktopUrl: string;
  imageMobileUrl: string;
  position: BannerPosition;
  categoryId?: string;
  startDate: string;
  endDate: string;
  status: BannerStatus;
  createdBy: string;
  lastUpdated: string;
  targetUrl: string;
}

// Cấu trúc dữ liệu thu thập từ Drawer Form
export interface BannerFormData {
  title: string;
  position: BannerPosition;
  categoryId: string;
  imageDesktopUrl: string;
  imageMobileUrl: string;
  targetUrl: string;
  startDate: string;
  endDate: string;
  status: BannerStatus;
}

// Dữ liệu giả lập để kiểm thử giao diện
const MOCK_BANNERS: BannerRecord[] = [
  {
    id: "bn-1",
    name: "Summer Sale Hero",
    imageDesktopUrl:
      "https://placehold.co/1920x600/e0f2fe/0284c7?text=Desktop+Banner",
    imageMobileUrl:
      "https://placehold.co/800x1200/e0f2fe/0284c7?text=Mobile+Banner",
    position: "Homepage Slider",
    startDate: "2024-06-01",
    endDate: "2024-08-31", // Ngày quá khứ để test khóa Expired
    status: "Inactive",
    createdBy: "Admin User",
    lastUpdated: "Today, 10:30 AM",
    targetUrl: "/collections/summer-sale",
  },
  {
    id: "bn-2",
    name: "Fashion Week",
    imageDesktopUrl:
      "https://placehold.co/1200x400/f3e8ff/7e22ce?text=Category+Desktop",
    imageMobileUrl:
      "https://placehold.co/800x800/f3e8ff/7e22ce?text=Category+Mobile",
    position: "Category",
    categoryId: "cat-fashion",
    startDate: "2028-12-01", // Ngày tương lai để test khóa Pending
    endDate: "2028-12-31",
    status: "Pending",
    createdBy: "Staff User",
    lastUpdated: "Yesterday, 3:45 PM",
    targetUrl: "/category/fashion",
  },
];

export function useBannerManagement() {
  const [records, setRecords] = useState<BannerRecord[]>(MOCK_BANNERS);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BannerStatus | "All">("All");
  const [positionFilter, setPositionFilter] = useState<BannerPosition | "All">(
    "All",
  );
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [drawerConfig, setDrawerConfig] = useState<{
    isOpen: boolean;
    mode: DrawerMode;
    record: BannerRecord | null;
  }>({
    isOpen: false,
    mode: "create",
    record: null,
  });

  const [deleteModalConfig, setDeleteModalConfig] = useState<{
    isOpen: boolean;
    idsToDelete: string[];
  }>({
    isOpen: false,
    idsToDelete: [],
  });

  // Lấy ngày hiện tại chuẩn ISO (YYYY-MM-DD)
  const getTodayString = () => new Date().toISOString().split("T")[0];

  // Lọc dữ liệu hiển thị trên bảng
  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchSearch =
        !normalizedSearch ||
        record.name.toLowerCase().includes(normalizedSearch);
      const matchStatus =
        statusFilter === "All" || record.status === statusFilter;
      const matchPosition =
        positionFilter === "All" || record.position === positionFilter;
      return matchSearch && matchStatus && matchPosition;
    });
  }, [records, search, statusFilter, positionFilter]);

  const totalPages = Math.ceil(filteredRecords.length / pagination.limit);
  const startIndex = (pagination.page - 1) * pagination.limit;
  const currentRecords = filteredRecords.slice(
    startIndex,
    startIndex + pagination.limit,
  );

  const actions = {
    changeSearch: (val: string) => {
      setSearch(val);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changeStatusFilter: (status: BannerStatus | "All") => {
      setStatusFilter(status);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changePositionFilter: (position: BannerPosition | "All") => {
      setPositionFilter(position);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    clearFilters: () => {
      setSearch("");
      setStatusFilter("All");
      setPositionFilter("All");
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changePage: (page: number) => setPagination((p) => ({ ...p, page })),
    changeLimit: (limit: number) => setPagination({ page: 1, limit }),
    toggleSelection: (id: string) => {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
      );
    },
    toggleSelectAll: () => {
      if (selectedIds.length === currentRecords.length) setSelectedIds([]);
      else setSelectedIds(currentRecords.map((r) => r.id));
    },
    openCreateDrawer: () =>
      setDrawerConfig({ isOpen: true, mode: "create", record: null }),
    openEditDrawer: (record: BannerRecord) =>
      setDrawerConfig({ isOpen: true, mode: "edit", record }),
    openViewDrawer: (record: BannerRecord) =>
      setDrawerConfig({ isOpen: true, mode: "view", record }),
    closeDrawer: () =>
      setDrawerConfig({ isOpen: false, mode: "create", record: null }),

    // Đảo trạng thái với điều kiện bảo vệ 2 tầng thời gian
    toggleBannerStatus: (id: string) => {
      const today = getTodayString();
      setRecords((prev) =>
        prev.map((r) => {
          if (r.id === id) {
            if (r.startDate && r.startDate > today) {
              toast.error("Không thể thao tác. Banner chưa đến ngày bắt đầu!");
              return r;
            }
            if (r.endDate && r.endDate < today) {
              toast.error(
                "Không thể kích hoạt banner đã hết hạn. Vui lòng gia hạn!",
              );
              return r;
            }
            const newStatus = r.status === "Active" ? "Inactive" : "Active";
            return { ...r, status: newStatus };
          }
          return r;
        }),
      );
    },
    bulkActivate: () => {
      if (selectedIds.length === 0) return;
      const today = getTodayString();
      setRecords((prev) =>
        prev.map((r) => {
          if (selectedIds.includes(r.id)) {
            // Bỏ qua không kích hoạt các banner vi phạm thời gian
            if (
              (r.startDate && r.startDate > today) ||
              (r.endDate && r.endDate < today)
            ) {
              return r;
            }
            return { ...r, status: "Active" };
          }
          return r;
        }),
      );
      setSelectedIds([]);
      toast.success("Đã kích hoạt các banner hợp lệ!");
    },
    bulkDeactivate: () => {
      if (selectedIds.length === 0) return;
      setRecords((prev) =>
        prev.map((r) =>
          selectedIds.includes(r.id) ? { ...r, status: "Inactive" } : r,
        ),
      );
      setSelectedIds([]);
      toast.success("Đã vô hiệu hóa các banner được chọn!");
    },
    requestDelete: (id: string) =>
      setDeleteModalConfig({ isOpen: true, idsToDelete: [id] }),
    requestBulkDelete: () => {
      if (selectedIds.length > 0)
        setDeleteModalConfig({ isOpen: true, idsToDelete: selectedIds });
    },
    closeDeleteModal: () =>
      setDeleteModalConfig({ isOpen: false, idsToDelete: [] }),
    confirmDelete: () => {
      const ids = deleteModalConfig.idsToDelete;
      setRecords((prev) => prev.filter((r) => !ids.includes(r.id)));
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      setDeleteModalConfig({ isOpen: false, idsToDelete: [] });
      toast.success(`Đã xóa thành công ${ids.length} banner!`);
    },
  };

  const handleDrawerSubmit = (data: BannerFormData) => {
    if (drawerConfig.mode === "create") {
      const newRecord: BannerRecord = {
        id: `bn-${Date.now()}`,
        name: data.title,
        position: data.position,
        categoryId: data.categoryId,
        imageDesktopUrl: data.imageDesktopUrl,
        imageMobileUrl: data.imageMobileUrl,
        targetUrl: data.targetUrl,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status,
        createdBy: "Admin User",
        lastUpdated: "Just now",
      };
      setRecords((prev) => [newRecord, ...prev]);
      toast.success("Tạo banner thành công!");
    } else if (drawerConfig.mode === "edit" && drawerConfig.record) {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === drawerConfig.record!.id
            ? {
                ...r,
                name: data.title,
                position: data.position,
                categoryId: data.categoryId,
                imageDesktopUrl: data.imageDesktopUrl,
                imageMobileUrl: data.imageMobileUrl,
                targetUrl: data.targetUrl,
                startDate: data.startDate,
                endDate: data.endDate,
                status: data.status,
                lastUpdated: "Just now",
              }
            : r,
        ),
      );
      toast.success("Cập nhật banner thành công!");
    }
  };

  return {
    currentRecords,
    selectedIds,
    pagination: {
      ...pagination,
      totalPages,
      totalFiltered: filteredRecords.length,
      startIndex,
    },
    search,
    statusFilter,
    positionFilter,
    drawerConfig,
    deleteModalConfig,
    actions,
    handleDrawerSubmit,
  };
}
