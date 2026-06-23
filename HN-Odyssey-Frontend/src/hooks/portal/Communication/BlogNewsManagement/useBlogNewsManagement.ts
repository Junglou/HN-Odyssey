import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

// --- INTERFACES & TYPES ---
export type BlogNewsStatus = "Published" | "Draft" | "Hidden";

interface CategoryTree {
  _id: string;
  name: string;
  children?: CategoryTree[];
}

export interface BEPostResponse {
  _id: string;
  title: string;
  slug: string;
  category_id?: string | { _id: string; name: string };
  author_id?: {
    _id: string;
    email?: string;
    full_name?: string;
    name?: string;
  };
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "HIDDEN";
  published_at?: string | null;
  created_at: string;
  thumbnail?: string;
  content?: string;
  meta_title?: string;
  meta_description?: string;
  summary?: string;
  embedded_product_ids?: Array<string | { _id: string }>;
}

export interface BECategoryResponse {
  _id: string;
  name: string;
}

export interface BEProductResponse {
  _id: string;
  name: string;
  price: string | number;
  categories?: Array<string | { _id: string; name?: string }>;
}

export interface FetchPostsParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}

export interface BlogNewsRecord {
  id: string;
  title: string;
  slug: string;
  category: string;
  author: string;
  status: BlogNewsStatus;
  publishDate: string;
  featuredImage: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  attachedProducts: string[];
}

export interface BlogNewsFormData {
  title: string;
  slug: string;
  categoryId: string;
  status: BlogNewsStatus;
  featuredImage: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  attachedProducts: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface PaginatedData<T> {
  data: T[];
  meta: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    itemsPerPage: number;
  };
}

// --- UTILS ---
export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
};

export const getFullImageUrl = (path: string) => {
  if (!path) return "";
  // Nếu đã là link web hoặc base64 thì giữ nguyên
  if (path.startsWith("http") || path.startsWith("data:image")) return path;

  // Lấy VITE_API_URL (VD: http://localhost:8080/api) và cắt bỏ chữ /api đi
  const baseUrl = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:8080";

  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
};

// Hàm phụ trợ: Cắt domain BE đi để gửi path tương đối gọn gàng xuống DB lưu trữ
export const getRelativeImageUrl = (fullUrl: string) => {
  if (!fullUrl) return "";
  const baseUrl = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:8080";

  if (fullUrl.startsWith(baseUrl)) {
    return fullUrl.replace(baseUrl, "");
  }
  return fullUrl;
};

const mapBEToFE = (post: BEPostResponse): BlogNewsRecord => ({
  id: post._id,
  title: post.title,
  slug: post.slug,
  category:
    typeof post.category_id === "object" && post.category_id !== null
      ? post.category_id.name || "Uncategorized"
      : "Uncategorized",
  author: post.author_id
    ? post.author_id.full_name ||
      post.author_id.name ||
      post.author_id.email ||
      "Admin"
    : "Admin",
  status:
    post.status === "PUBLISHED"
      ? "Published"
      : post.status === "HIDDEN"
        ? "Hidden"
        : "Draft",
  publishDate: post.published_at
    ? new Date(post.published_at).toISOString().split("T")[0]
    : post.created_at
      ? new Date(post.created_at).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
  featuredImage: getFullImageUrl(post.thumbnail || ""),
  content: post.content || "",
  metaTitle: post.meta_title || "",
  metaDescription: post.meta_description || post.summary || "",
  attachedProducts:
    post.embedded_product_ids?.map((p: string | { _id: string }) =>
      typeof p === "string" ? p : p._id,
    ) || [],
});

const mapFEToBE = (data: BlogNewsFormData) => ({
  title: data.title,
  slug: data.slug,
  category_id: data.categoryId || undefined,
  summary: data.metaDescription || "No summary provided",
  content: data.content,
  thumbnail: getRelativeImageUrl(data.featuredImage),
  meta_title: data.metaTitle,
  meta_description: data.metaDescription,
  embedded_product_ids: data.attachedProducts,
  status:
    data.status === "Published"
      ? "PUBLISHED"
      : data.status === "Hidden"
        ? "HIDDEN"
        : "DRAFT",
});

const base64ToFile = async (
  base64Url: string,
  fileName: string,
): Promise<File> => {
  const res = await fetch(base64Url);
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type });
};

// 2. DI CHUYỂN HÀM NÀY RA NGOÀI HOÀN TOÀN (Bên trên export function useBlogNewsManagement)
// Đã thay 'any' bằng 'CategoryTree' để fix lỗi Eslint line 202
const flattenCategories = (
  categories: CategoryTree[],
): BECategoryResponse[] => {
  let flatList: BECategoryResponse[] = [];
  for (const cat of categories) {
    flatList.push({ _id: cat._id, name: cat.name });
    if (cat.children && cat.children.length > 0) {
      flatList = flatList.concat(flattenCategories(cat.children));
    }
  }
  return flatList;
};

// --- MAIN HOOK ---
export function useBlogNewsManagement() {
  const [records, setRecords] = useState<BlogNewsRecord[]>([]);
  const [categoriesList, setCategoriesList] = useState<BECategoryResponse[]>(
    [],
  );
  const [productsList, setProductsList] = useState<BEProductResponse[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BlogNewsStatus | "All">(
    "All",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

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

  const fetchPosts = useCallback(async () => {
    try {
      const params: FetchPostsParams = { page, limit };
      if (search) params.search = search;
      if (statusFilter !== "All") params.status = statusFilter.toUpperCase();

      // ĐÃ SỬA URL Ở ĐÂY: Dùng đúng Endpoint của dự án
      const [resPosts, resCats, resProds] = await Promise.all([
        axiosClient.get<ApiResponse<PaginatedData<BEPostResponse>>>(
          "/marketing/content/posts",
          { params },
        ),
        axiosClient.get("/categories/admin/tree-view").catch(() => null),
        axiosClient
          .get("/products", { params: { limit: 1000 } })
          .catch(() => null),
      ]);

      // Xử lý Bài viết (Giữ nguyên vì đã chuẩn BaseResponse)
      if (resPosts.data?.success) {
        setRecords(resPosts.data.data.data.map(mapBEToFE));
        setTotalFiltered(resPosts.data.data.meta.totalItems);
        setTotalPages(resPosts.data.data.meta.totalPages);
      }

      // Xử lý Danh mục (Tránh lỗi cây thư mục và không có BaseResponse)
      if (resCats?.data) {
        // Backend có thể trả thẳng mảng array, hoặc bọc trong data
        const catData = Array.isArray(resCats.data)
          ? resCats.data
          : resCats.data.data;
        if (catData) {
          setCategoriesList(flattenCategories(catData));
        }
      }

      // Xử lý Sản phẩm
      if (resProds?.data) {
        // Backend có thể trả về Pagination Object { data: [], meta: {} } hoặc Array
        const prodData = Array.isArray(resProds.data)
          ? resProds.data
          : resProds.data.data || [];

        if (Array.isArray(prodData)) {
          setProductsList(prodData);
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  }, [page, limit, search, statusFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const startIndex = (page - 1) * limit;

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
    if (isAll) setSelectedIds(new Set(records.map((r) => r.id)));
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

  const handleDrawerSubmit = async (data: BlogNewsFormData) => {
    setDrawerConfig((prev) => ({ ...prev, isSubmitting: true }));
    try {
      let finalImageUrl = data.featuredImage;

      if (finalImageUrl.startsWith("data:image")) {
        const file = await base64ToFile(
          finalImageUrl,
          `featured-${Date.now()}.png`,
        );
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);

        const uploadRes = await axiosClient.post<{ path: string }>(
          "/upload/single",
          formDataUpload,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );

        if (uploadRes.data?.path) {
          finalImageUrl = getFullImageUrl(uploadRes.data.path);
        }
      }

      const payload = mapFEToBE({ ...data, featuredImage: finalImageUrl });

      if (drawerConfig.mode === "add") {
        await axiosClient.post("/marketing/content/posts", payload);
        toast.success("Tạo bài viết mới thành công!");
      } else if (drawerConfig.mode === "edit" && drawerConfig.editingRecord) {
        await axiosClient.patch(
          `/marketing/content/posts/${drawerConfig.editingRecord.id}`,
          payload,
        );
        toast.success("Cập nhật bài viết thành công!");
      }

      await fetchPosts();
      closeDrawer();
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown } };
      console.error("Submit failed", err.response?.data || error);
      toast.error("Đã xảy ra lỗi khi lưu bài viết. Vui lòng thử lại!");
    } finally {
      setDrawerConfig((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const openDeleteModal = (id?: string) => {
    if (id) setDeleteModalConfig({ isOpen: true, targetId: id, isBulk: false });
    else if (selectedIds.size > 0)
      setDeleteModalConfig({ isOpen: true, isBulk: true });
  };

  const closeDeleteModal = () =>
    setDeleteModalConfig({ isOpen: false, isBulk: false });

  const handleConfirmDelete = async () => {
    try {
      if (deleteModalConfig.isBulk) {
        await axiosClient.patch("/marketing/content/posts/bulk/delete", {
          ids: Array.from(selectedIds),
        });
        setSelectedIds(new Set());
        toast.success("Đã xóa các bài viết được chọn!");
      } else if (deleteModalConfig.targetId) {
        await axiosClient.delete(
          `/marketing/content/posts/${deleteModalConfig.targetId}`,
        );
        toast.success("Đã xóa bài viết thành công!");
      }
      await fetchPosts();
    } catch (error) {
      console.error("Delete failed", error);
      toast.error("Đã xảy ra lỗi khi xóa bài viết. Vui lòng thử lại!");
    } finally {
      closeDeleteModal();
    }
  };

  const executeBulkStatusChange = async (
    targetStatus: "PUBLISHED" | "HIDDEN",
  ) => {
    try {
      await axiosClient.patch("/marketing/content/posts/bulk/status", {
        ids: Array.from(selectedIds),
        status: targetStatus,
      });
      setSelectedIds(new Set());
      await fetchPosts();
      toast.success(`Đã cập nhật trạng thái thành ${targetStatus} thành công!`);
    } catch (error) {
      console.error("Bulk update failed", error);
      toast.error("Đã xảy ra lỗi khi cập nhật trạng thái. Vui lòng thử lại!");
    }
  };

  const bulkPublish = () => executeBulkStatusChange("PUBLISHED");
  const bulkHide = () => executeBulkStatusChange("HIDDEN");
  const bulkDelete = () => openDeleteModal();

  return {
    records,
    categoriesList,
    productsList,
    pagination: { page, limit, totalPages, totalFiltered, startIndex },
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
