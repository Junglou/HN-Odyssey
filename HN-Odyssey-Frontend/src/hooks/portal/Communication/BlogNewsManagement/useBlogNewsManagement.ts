import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";
import type { UserPayload } from "../../../../types/auth";
import { Action, Resource } from "../../../../types/permissions";
import { USER_KEY } from "../../../../utils/tokenStorage";
import { getApiErrorMessage } from "../../../../utils/apiError";

// interfaces and types
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
  categoryId: string;
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

// utils
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
  // nếu đã là link web hoặc base64 thì giữ nguyên
  if (path.startsWith("http") || path.startsWith("data:image")) return path;

  // lấy biến môi trường và cắt bỏ chữ api ở đuôi
  const baseUrl = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:8080";

  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
};

// hàm phụ trợ cắt domain backend để gửi path tương đối xuống database lưu trữ
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
  categoryId:
    typeof post.category_id === "object" && post.category_id !== null
      ? post.category_id._id
      : typeof post.category_id === "string"
        ? post.category_id
        : "",
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
  // KHÔNG gửi status: trạng thái đổi qua publish/unpublish (quyền riêng)
});

const base64ToFile = async (
  base64Url: string,
  fileName: string,
): Promise<File> => {
  const res = await fetch(base64Url);
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type });
};

// di chuyển hàm này ra ngoài hoàn toàn
const flattenCategories = (
  categories: CategoryTree[],
  parentPath = "",
): BECategoryResponse[] => {
  let flatList: BECategoryResponse[] = [];
  for (const cat of categories) {
    const currentPath = parentPath ? `${parentPath} > ${cat.name}` : cat.name;
    flatList.push({ _id: cat._id, name: currentPath });
    if (cat.children && cat.children.length > 0) {
      flatList = flatList.concat(flattenCategories(cat.children, currentPath));
    }
  }
  return flatList;
};

const useLocalAuth = () => {
  const [user] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      if (stored) return JSON.parse(stored) as UserPayload;
    } catch (error) {
      console.warn("Không thể parse dữ liệu user từ localStorage:", error);
    }
    return null;
  });
  return { user };
};

// main hook
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
  const [isLoading, setIsLoading] = useState(true);

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

  const canCreate = hasPermission(Resource.CONTENT_POSTS, Action.CREATE);
  const canUpdate = hasPermission(Resource.CONTENT_POSTS, Action.UPDATE);
  const canDelete = hasPermission(Resource.CONTENT_POSTS, Action.DELETE);
  const canPublish = hasPermission(Resource.CONTENT_POSTS, Action.PUBLISH);
  const canUnpublish = hasPermission(Resource.CONTENT_POSTS, Action.UNPUBLISH);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: FetchPostsParams = { page, limit };
      if (search) params.search = search;
      if (statusFilter !== "All") params.status = statusFilter.toUpperCase();

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

      // xử lý bài viết
      if (resPosts.data?.success) {
        setRecords(resPosts.data.data.data.map(mapBEToFE));
        setTotalFiltered(resPosts.data.data.meta.totalItems);
        setTotalPages(resPosts.data.data.meta.totalPages);
      }

      // xử lý danh mục
      if (resCats?.data) {
        const catData = Array.isArray(resCats.data)
          ? resCats.data
          : resCats.data.data;
        if (catData) {
          setCategoriesList(flattenCategories(catData));
        }
      }

      // xử lý sản phẩm
      if (resProds?.data) {
        const prodData = Array.isArray(resProds.data)
          ? resProds.data
          : resProds.data.data || [];

        if (Array.isArray(prodData)) {
          setProductsList(prodData);
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
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

  const openAddDrawer = () => {
    if (!canCreate) return toast.error("Bạn không có quyền tạo Bài viết mới.");
    setDrawerConfig({
      isOpen: true,
      mode: "add",
      editingRecord: null,
      isSubmitting: false,
    });
  };

  // gọi api lấy chi tiết bài viết để lấy đầy đủ trường content phục vụ việc edit
  const openEditDrawer = async (record: BlogNewsRecord) => {
    if (!canUpdate)
      return toast.error("Bạn không có quyền chỉnh sửa Bài viết.");
    try {
      const res = await axiosClient.get(
        `/marketing/content/posts/${record.id}/detail`,
      );
      if (res.data?.success) {
        const fullRecord = mapBEToFE(res.data.data);
        setDrawerConfig({
          isOpen: true,
          mode: "edit",
          editingRecord: fullRecord,
          isSubmitting: false,
        });
      }
    } catch (error) {
      console.error("Failed to fetch post detail:", error);
      toast.error(
        getApiErrorMessage(error, "Đã xảy ra lỗi khi tải chi tiết bài viết!"),
      );
    }
  };

  // gọi api lấy chi tiết bài viết để lấy đầy đủ trường content phục vụ việc view
  const openViewDrawer = async (record: BlogNewsRecord) => {
    try {
      const res = await axiosClient.get(
        `/marketing/content/posts/${record.id}/detail`,
      );
      if (res.data?.success) {
        const fullRecord = mapBEToFE(res.data.data);
        setDrawerConfig({
          isOpen: true,
          mode: "view",
          editingRecord: fullRecord,
          isSubmitting: false,
        });
      }
    } catch (error) {
      console.error("Failed to fetch post detail:", error);
      toast.error(
        getApiErrorMessage(error, "Đã xảy ra lỗi khi tải chi tiết bài viết!"),
      );
    }
  };

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

      let postId: string | undefined;
      let oldStatus: BlogNewsStatus = "Draft";

      if (drawerConfig.mode === "add") {
        const res = await axiosClient.post("/marketing/content/posts", payload);
        postId = res.data?.data?._id;
      } else if (drawerConfig.mode === "edit" && drawerConfig.editingRecord) {
        postId = drawerConfig.editingRecord.id;
        oldStatus = drawerConfig.editingRecord.status;
        await axiosClient.patch(`/marketing/content/posts/${postId}`, payload);
      }

      // Đổi trạng thái (nếu có) qua route riêng theo quyền PUBLISH / UNPUBLISH
      let statusNote = "";
      if (postId && data.status !== oldStatus) {
        if (data.status === "Published") {
          if (canPublish) {
            await axiosClient.patch("/marketing/content/posts/bulk/publish", {
              ids: [postId],
            });
          } else {
            statusNote =
              " Bạn không có quyền Publish nên bài giữ trạng thái cũ.";
          }
        } else if (canUnpublish) {
          await axiosClient.patch("/marketing/content/posts/bulk/unpublish", {
            ids: [postId],
            status: data.status === "Hidden" ? "HIDDEN" : "DRAFT",
          });
        } else {
          statusNote =
            " Bạn không có quyền gỡ xuất bản nên bài giữ trạng thái cũ.";
        }
      }

      const baseMsg =
        drawerConfig.mode === "add"
          ? "Tạo bài viết mới thành công!"
          : "Cập nhật bài viết thành công!";
      if (statusNote) toast.warning(baseMsg + statusNote);
      else toast.success(baseMsg);

      await fetchPosts();
      closeDrawer();
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown } };
      console.error("Submit failed", err.response?.data || error);
      toast.error(
        getApiErrorMessage(
          error,
          "Đã xảy ra lỗi khi lưu bài viết. Vui lòng thử lại!",
        ),
      );
    } finally {
      setDrawerConfig((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const openDeleteModal = (id?: string) => {
    if (!canDelete) return toast.error("Bạn không có quyền xóa Bài viết.");
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
      toast.error(
        getApiErrorMessage(
          error,
          "Đã xảy ra lỗi khi xóa bài viết. Vui lòng thử lại!",
        ),
      );
    } finally {
      closeDeleteModal();
    }
  };

  const executeBulkStatusChange = async (
    targetStatus: "PUBLISHED" | "HIDDEN",
  ) => {
    const isPublish = targetStatus === "PUBLISHED";
    if (isPublish ? !canPublish : !canUnpublish)
      return toast.error(
        isPublish
          ? "Bạn không có quyền xuất bản Bài viết."
          : "Bạn không có quyền gỡ / ẩn Bài viết.",
      );
    try {
      await axiosClient.patch(
        isPublish
          ? "/marketing/content/posts/bulk/publish"
          : "/marketing/content/posts/bulk/unpublish",
        isPublish
          ? { ids: Array.from(selectedIds) }
          : { ids: Array.from(selectedIds), status: "HIDDEN" },
      );
      setSelectedIds(new Set());
      await fetchPosts();
      toast.success(`Đã cập nhật trạng thái thành ${targetStatus} thành công!`);
    } catch (error) {
      console.error("Bulk update failed", error);
      toast.error(
        getApiErrorMessage(
          error,
          "Đã xảy ra lỗi khi cập nhật trạng thái. Vui lòng thử lại!",
        ),
      );
    }
  };

  const bulkPublish = () => executeBulkStatusChange("PUBLISHED");
  const bulkHide = () => executeBulkStatusChange("HIDDEN");
  const bulkDelete = () => openDeleteModal();

  return {
    records,
    isLoading,
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
    permissions: { canCreate, canUpdate, canDelete, canPublish, canUnpublish },
  };
}
