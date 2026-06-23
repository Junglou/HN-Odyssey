import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

export type BannerStatus = "Active" | "Inactive" | "Pending";
export type BannerPosition =
  | "Homepage Slider"
  | "Category"
  | "Promotion"
  | "hero_banner"
  | "category_showcase";
export type DrawerMode = "create" | "edit" | "view";

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

// Interface thay thế cho "any" ở dòng 37
export interface BEBannerResponse {
  _id: string;
  title?: string;
  image_pc?: string;
  image_mobile?: string;
  position?: string;
  category_id?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  updated_at?: string;
  link?: string;
  created_by?: string;
}

// Interface thay thế cho "any" ở dòng 107
export interface FetchBannersParams {
  page: number;
  limit: number;
  position?: string;
  status?: string;
}

// Interface thay thế cho "any" ở dòng 296
export interface BannerPayload {
  title: string;
  link: string;
  position: string;
  image_pc: string;
  image_mobile: string;
  start_date: string;
  end_date: string;
  category_id?: string;
  status?: string;
}

// Hàm Helper map dữ liệu từ BE sang FE
const mapBannerToFE = (beBanner: BEBannerResponse): BannerRecord => {
  let mappedStatus: BannerStatus = "Inactive";
  if (beBanner.status === "ACTIVE") mappedStatus = "Active";
  if (beBanner.status === "WAITING") mappedStatus = "Pending";
  if (beBanner.status === "HIDDEN") mappedStatus = "Inactive";

  // Đảm bảo domain nối vào ảnh nếu BE chỉ trả relative path
  const processImageUrl = (url?: string) => {
    if (!url) return "";

    // Nếu URL đã là tuyệt đối (http, base64, blob) thì giữ nguyên
    if (
      url.startsWith("http") ||
      url.startsWith("data:") ||
      url.startsWith("blob:")
    ) {
      return url;
    }

    // Lấy baseUrl từ env (VD: http://localhost:8080/api)
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";

    // Cắt bỏ đuôi /api (nếu có) để trỏ về root domain (http://localhost:8080)
    const serverRootUrl = baseUrl.replace(/\/api.*$/, "").replace(/\/$/, "");

    // Đảm bảo có dấu "/" ở đầu path ảnh
    const formattedUrl = url.startsWith("/") ? url : `/${url}`;

    // Kết quả chuẩn: http://localhost:8080/uploads/xxx.png
    return `${serverRootUrl}${formattedUrl}`;
  };

  return {
    id: beBanner._id,
    name: beBanner.title || "Untitled",
    imageDesktopUrl: processImageUrl(beBanner.image_pc),
    imageMobileUrl: processImageUrl(beBanner.image_mobile),
    position: (beBanner.position as BannerPosition) || "Homepage Slider",
    categoryId: beBanner.category_id || "",
    startDate: beBanner.start_date ? beBanner.start_date.split("T")[0] : "",
    endDate: beBanner.end_date ? beBanner.end_date.split("T")[0] : "",
    status: mappedStatus,
    createdBy: beBanner.created_by || "Admin",
    lastUpdated: beBanner.updated_at
      ? new Date(beBanner.updated_at).toLocaleDateString()
      : "",
    targetUrl: beBanner.link || "",
  };
};

export function useBannerManagement() {
  const [records, setRecords] = useState<BannerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BannerStatus | "All">("All");
  const [positionFilter, setPositionFilter] = useState<BannerPosition | "All">(
    "All",
  );
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [totalPagesBE, setTotalPagesBE] = useState(1);
  const [totalFilteredBE, setTotalFilteredBE] = useState(0);

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

  const getTodayString = () => new Date().toISOString().split("T")[0];

  const fetchBanners = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: FetchBannersParams = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (positionFilter !== "All") params.position = positionFilter;
      if (statusFilter !== "All") {
        params.status =
          statusFilter === "Active"
            ? "ACTIVE"
            : statusFilter === "Pending"
              ? "WAITING"
              : "HIDDEN";
      }

      const res = await axiosClient.get("/marketing/content/banners", {
        params,
      });

      if (res.data?.success) {
        const mappedData = res.data.data.data.map(mapBannerToFE);
        setRecords(mappedData);
        setTotalPagesBE(res.data.data.meta.totalPages);
        setTotalFilteredBE(res.data.data.meta.totalItems);
      }
    } catch (error: unknown) {
      console.error("Fetch banners error:", error);

      // Ép kiểu error để lấy thông tin mã lỗi từ axiosClient interceptor
      const err = error as {
        status?: number;
        message?: string;
        data?: { message?: string };
      };

      if (err?.status === 401) {
        toast.error(
          "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn (401 Unauthorized).",
        );
      } else if (err?.status === 403) {
        toast.error(
          "Bạn không có quyền truy cập danh sách Banner (403 Forbidden).",
        );
      } else {
        const errorMsg =
          err?.data?.message ||
          err?.message ||
          "Không thể tải danh sách Banner!";
        toast.error(
          typeof errorMsg === "string"
            ? errorMsg
            : "Có lỗi xảy ra khi tải dữ liệu!",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, positionFilter, statusFilter]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const currentRecords = useMemo(() => {
    if (!search.trim()) return records;
    const normalizedSearch = search.trim().toLowerCase();
    return records.filter((r) =>
      r.name.toLowerCase().includes(normalizedSearch),
    );
  }, [records, search]);

  const startIndex = (pagination.page - 1) * pagination.limit;

  const actions = {
    changeSearch: (val: string) => {
      setSearch(val);
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

    toggleBannerStatus: async (id: string) => {
      const banner = records.find((r) => r.id === id);
      if (!banner) return;
      const today = getTodayString();
      if (banner.startDate && banner.startDate > today) {
        toast.error("Không thể thao tác. Banner chưa đến ngày bắt đầu!");
        return;
      }
      if (banner.endDate && banner.endDate < today) {
        toast.error("Không thể kích hoạt banner đã hết hạn. Vui lòng gia hạn!");
        return;
      }
      const newStatusBE = banner.status === "Active" ? "HIDDEN" : "ACTIVE";
      try {
        await axiosClient.patch(`/marketing/content/banners/${id}`, {
          status: newStatusBE,
        });
        toast.success("Đã cập nhật trạng thái banner!");
        fetchBanners();
      } catch (error) {
        console.error("Toggle status error:", error); // Xử lý lỗi dòng 210
        toast.error("Cập nhật trạng thái thất bại!");
      }
    },
    bulkActivate: async () => {
      if (selectedIds.length === 0) return;
      try {
        setIsLoading(true);
        // CHUẨN CLEAN CODE: Gọi ĐÚNG 1 Request duy nhất
        await axiosClient.patch(`/marketing/content/banners/bulk/status`, {
          ids: selectedIds,
          status: "ACTIVE",
        });

        toast.success(`Đã kích hoạt thành công!`);
        setSelectedIds([]);
        fetchBanners();
      } catch (error) {
        console.error("Bulk activate error:", error);
        toast.error("Có lỗi xảy ra khi kích hoạt hàng loạt!");
      } finally {
        setIsLoading(false);
      }
    },
    bulkDeactivate: async () => {
      if (selectedIds.length === 0) return;
      try {
        setIsLoading(true);
        // Gọi ĐÚNG 1 Request duy nhất lên API Bulk của BE với status là HIDDEN
        await axiosClient.patch(`/marketing/content/banners/bulk/status`, {
          ids: selectedIds,
          status: "HIDDEN",
        });

        toast.success(`Đã vô hiệu hóa thành công banner!`);
        setSelectedIds([]);
        fetchBanners(); // Tải lại danh sách
      } catch (error) {
        console.error("Bulk deactivate error:", error);
        toast.error("Có lỗi xảy ra khi vô hiệu hóa hàng loạt!");
      } finally {
        setIsLoading(false);
      }
    },
    requestDelete: (id: string) =>
      setDeleteModalConfig({ isOpen: true, idsToDelete: [id] }),
    requestBulkDelete: () => {
      if (selectedIds.length > 0)
        setDeleteModalConfig({ isOpen: true, idsToDelete: selectedIds });
    },
    closeDeleteModal: () =>
      setDeleteModalConfig({ isOpen: false, idsToDelete: [] }),
    confirmDelete: async () => {
      const ids = deleteModalConfig.idsToDelete;
      try {
        await Promise.all(
          ids.map((id) =>
            axiosClient.delete(`/marketing/content/banners/${id}`),
          ),
        );
        toast.success(`Đã xóa thành công ${ids.length} banner!`);
        setSelectedIds([]);
        setDeleteModalConfig({ isOpen: false, idsToDelete: [] });
        fetchBanners();
      } catch (error) {
        console.error("Delete error:", error); // Xử lý lỗi dòng 236
        toast.error("Có lỗi xảy ra khi xóa banner!");
      }
    },
  };

  // --- HÀM TRÍCH XUẤT BLOB VÀ UPLOAD ẢNH ---
  const uploadImageToBE = async (imageUrl: string): Promise<string> => {
    if (!imageUrl.startsWith("blob:")) {
      if (imageUrl.includes("/uploads/")) {
        return "/uploads/" + imageUrl.split("/uploads/")[1];
      }
      return imageUrl;
    }

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      const ext = blob.type.split("/")[1] || "jpg";
      const file = new File([blob], `banner_${Date.now()}.${ext}`, {
        type: blob.type,
      });

      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await axiosClient.post("/upload/single", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      return uploadRes.data.path;
    } catch (error) {
      console.error("Upload error:", error);
      throw new Error("Không thể tải hình ảnh lên hệ thống.");
    }
  };

  const handleDrawerSubmit = async (data: BannerFormData) => {
    try {
      setIsLoading(true);

      let desktopImagePath = data.imageDesktopUrl;
      let mobileImagePath = data.imageMobileUrl;

      toast.info("Đang xử lý hình ảnh...");

      desktopImagePath = await uploadImageToBE(data.imageDesktopUrl);
      if (data.imageMobileUrl) {
        mobileImagePath = await uploadImageToBE(data.imageMobileUrl);
      }

      const payload: BannerPayload = {
        title: data.title,
        link: data.targetUrl,
        position: data.position,
        image_pc: desktopImagePath,
        image_mobile: mobileImagePath || desktopImagePath,
        start_date: data.startDate
          ? new Date(data.startDate).toISOString()
          : new Date().toISOString(),
        end_date: data.endDate
          ? new Date(data.endDate).toISOString()
          : new Date().toISOString(),
      };

      if (data.categoryId) {
        payload.category_id = data.categoryId;
      }

      if (drawerConfig.mode === "create") {
        await axiosClient.post("/marketing/content/banners", payload);
        toast.success("Tạo banner thành công!");
      } else if (drawerConfig.mode === "edit" && drawerConfig.record) {
        if (data.status) {
          payload.status =
            data.status === "Active"
              ? "ACTIVE"
              : data.status === "Pending"
                ? "WAITING"
                : "HIDDEN";
        }
        await axiosClient.patch(
          `/marketing/content/banners/${drawerConfig.record.id}`,
          payload,
        );
        toast.success("Cập nhật banner thành công!");
      }

      actions.closeDrawer();
      fetchBanners();
    } catch (error: unknown) {
      // Xử lý lỗi ép kiểu `any` dòng 335
      console.error("Submit error:", error);
      const err = error as { message?: string; data?: { message?: string } };
      const errorMsg =
        err?.data?.message || err?.message || "Có lỗi xảy ra khi lưu banner!";
      toast.error(
        typeof errorMsg === "string" ? errorMsg : "Dữ liệu không hợp lệ!",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    currentRecords,
    selectedIds,
    pagination: {
      ...pagination,
      totalPages: totalPagesBE,
      totalFiltered: totalFilteredBE,
      startIndex,
    },
    search,
    statusFilter,
    positionFilter,
    drawerConfig,
    deleteModalConfig,
    actions,
    handleDrawerSubmit,
    isLoading, // Trả ra isLoading để xóa cảnh báo biến không được sử dụng dòng 71
  };
}
