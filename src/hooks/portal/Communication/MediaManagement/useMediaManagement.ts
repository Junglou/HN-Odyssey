import { useState, useCallback, useEffect } from "react";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import axiosClient from "../../../../api/axiosClient";

// --- ĐỊNH NGHĨA CÁC INTERFACE NGHIÊM NGẶT ---
export type MediaStatus = "Published" | "Draft" | "Hidden";
export type MediaType = "Product" | "Category" | "Variant";

export interface MediaRecord {
  id: string;
  url: string;
  fileName: string;
  type: MediaType;
  targetId: string;
  status: MediaStatus;
  isPrimary: boolean;
  altText: string;
  size: number;
}

export interface MediaFormData {
  type: MediaType | "";
  targetId: string;
  altText: string;
  status: MediaStatus;
}

export interface UploadDraft {
  id: string;
  file: File;
  previewUrl: string;
}

export interface BackendMediaItem {
  _id: string;
  url: string;
  fileName: string;
  originalName: string;
  type: string;
  targetId: string;
  status: string;
  isPrimary: boolean;
  altText: string;
  size: number;
  mimetype: string;
  created_at?: string;
  updated_at?: string;
}

export interface BackendPaginatedMeta {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  totalPages: number;
}

export interface BackendPaginatedResponse<T> {
  data: T[];
  meta: BackendPaginatedMeta;
}

export interface BackendBaseResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// Interface phục vụ tính năng Search Target (Product/Category)
export interface TargetOption {
  id: string;
  label: string;
}

// Helper: Phân tích lỗi an toàn tuyệt đối không dùng any
const getErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    return error.response?.data?.message || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Đã xảy ra lỗi không xác định.";
};

const getFullMediaUrl = (url: string): string => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const baseUrl = import.meta.env.VITE_API_URL || "";
  const cleanBaseUrl = baseUrl.replace(/\/api\/?$/, "");
  return `${cleanBaseUrl}${url}`;
};

export interface CategoryTreeNode {
  _id: string;
  id?: string;
  name: string;
  children?: CategoryTreeNode[];
}

export function useMediaManagement() {
  const [records, setRecords] = useState<MediaRecord[]>([]);
  const [totalFiltered, setTotalFiltered] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);

  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<MediaStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<MediaType | "All">("All");
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  const [drawerConfig, setDrawerConfig] = useState<{
    isOpen: boolean;
    mode: "upload" | "edit" | "view";
    uploadDrafts: UploadDraft[];
    previewUrl: string;
    editingRecord: MediaRecord | null;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    mode: "upload",
    uploadDrafts: [],
    previewUrl: "",
    editingRecord: null,
    isSubmitting: false,
  });

  const [deleteModalConfig, setDeleteModalConfig] = useState<{
    isOpen: boolean;
    mediaId: string | null;
  }>({ isOpen: false, mediaId: null });

  const [cropModalConfig, setCropModalConfig] = useState<{
    isOpen: boolean;
    mediaRecord: MediaRecord | null;
  }>({
    isOpen: false,
    mediaRecord: null,
  });

  const fetchMedia = useCallback(async () => {
    try {
      const params: Record<string, string | number> = {
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter,
        type: typeFilter,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      const response = await axiosClient.get<
        BackendBaseResponse<BackendPaginatedResponse<BackendMediaItem>>
      >("/marketing/media", { params });

      const { data, meta } = response.data.data;

      const mappedRecords: MediaRecord[] = data.map((item) => ({
        id: item._id,
        url: getFullMediaUrl(item.url),
        fileName: item.originalName || item.fileName,
        type: item.type as MediaType,
        targetId: item.targetId,
        status: item.status as MediaStatus,
        isPrimary: item.isPrimary,
        altText: item.altText,
        size: item.size,
      }));

      setRecords(mappedRecords);
      setTotalFiltered(meta.totalItems);
      setTotalPages(meta.totalPages);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  }, [pagination.page, pagination.limit, search, statusFilter, typeFilter]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchMedia();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchMedia]);

  // --- THAY THẾ TOÀN BỘ HÀM searchTargets BẰNG ĐOẠN NÀY ---
  const searchTargets = useCallback(
    async (type: MediaType, keyword: string): Promise<TargetOption[]> => {
      try {
        if (!keyword.trim()) return [];

        if (type === "Category") {
          const res = await axiosClient.get(`/categories/search`, {
            params: { q: keyword },
          });
          const rawCategories = (res.data?.data || res.data) as Array<{
            _id: string;
            name: string;
          }>;
          return rawCategories.map((c) => ({
            id: c._id,
            label: c.name,
          }));
        }

        // Định nghĩa Type chuẩn cho Product
        interface ProductApiItem {
          _id: string;
          name: string;
          has_variants?: boolean;
          variants?: Array<{ sku: string; price: number }>;
        }

        if (type === "Product") {
          const res = await axiosClient.get(`/products`, {
            params: { keyword: keyword, limit: 10 },
          });
          // API /products không bọc BaseResponse, nên list nằm ngay ở res.data.data
          const productsArray = (res.data.data || []) as ProductApiItem[];

          return productsArray.map((p) => ({
            id: p._id,
            label: p.name,
          }));
        }

        if (type === "Variant") {
          // Trích xuất mã SKU mẹ để tìm kiếm chính xác
          const baseKeyword = keyword.split("-")[0];
          const res = await axiosClient.get(`/products`, {
            params: { keyword: baseKeyword, limit: 15 },
          });

          const productsArray = (res.data.data || []) as ProductApiItem[];
          const uniqueVariants = new Map<string, TargetOption>();

          productsArray.forEach((product) => {
            if (
              product.has_variants &&
              product.variants &&
              product.variants.length > 0
            ) {
              product.variants.forEach((v) => {
                // Lọc lại ở Frontend để đảm bảo khớp đúng Variant SKU hoặc tên sản phẩm
                if (
                  v.sku.toLowerCase().includes(keyword.toLowerCase()) ||
                  product.name.toLowerCase().includes(keyword.toLowerCase())
                ) {
                  uniqueVariants.set(v.sku, {
                    id: v.sku,
                    label: `${product.name} - [${v.sku}]`,
                  });
                }
              });
            }
          });

          return Array.from(uniqueVariants.values());
        }

        return [];
      } catch (error: unknown) {
        console.error("Lỗi khi tìm kiếm Target:", getErrorMessage(error));
        return [];
      }
    },
    [],
  );

  // --- THAY THẾ TOÀN BỘ HÀM resolveTargetName BẰNG ĐOẠN NÀY ---
  const resolveTargetName = useCallback(
    async (type: MediaType, id: string): Promise<string> => {
      if (!id) return "";
      try {
        if (type === "Product") {
          const res = await axiosClient.get(`/products/${id}`);
          const data = res.data.data || res.data;
          return (data as { name: string })?.name || id;
        }

        if (type === "Variant") {
          // Trích xuất mã SKU mẹ để lấy danh sách biến thể
          const baseKeyword = id.split("-")[0];
          const res = await axiosClient.get(`/products`, {
            params: { keyword: baseKeyword, limit: 10 },
          });

          const productsArray = (res.data.data || []) as Array<{
            name: string;
            variants?: Array<{ sku: string }>;
          }>;

          // Duyệt qua kết quả để tìm đích danh sản phẩm chứa biến thể này
          for (const product of productsArray) {
            if (
              product.variants &&
              product.variants.some((v) => v.sku === id)
            ) {
              return `${product.name} - [${id}]`;
            }
          }
          return id;
        }

        if (type === "Category") {
          const res = await axiosClient.get(`/categories/admin/tree-view`);
          const treeData = (res.data.data ||
            res.data ||
            []) as CategoryTreeNode[];

          const findInTree = (nodes: CategoryTreeNode[]): string | null => {
            for (const node of nodes) {
              if (node._id === id || node.id === id) return node.name;
              if (node.children && node.children.length > 0) {
                const found = findInTree(node.children);
                if (found) return found;
              }
            }
            return null;
          };

          const name = findInTree(treeData);
          return name || id;
        }
      } catch (error: unknown) {
        console.error("Không thể dịch ID sang Tên:", error);
      }
      return id;
    },
    [],
  );

  const startIndex = (pagination.page - 1) * pagination.limit;

  const validateFile = useCallback((file: File): boolean => {
    const isImage = ["image/jpeg", "image/png", "image/webp"].includes(
      file.type,
    );
    const isVideo = file.type === "video/mp4";

    if (!isImage && !isVideo) {
      toast.error(
        `Định dạng không hợp lệ cho tệp ${file.name}. Chỉ hỗ trợ JPG, PNG, WEBP, MP4.`,
      );
      return false;
    }
    if (isImage && file.size > 20 * 1024 * 1024) {
      toast.error(`Kích thước ảnh ${file.name} vượt quá giới hạn 20MB.`);
      return false;
    }
    if (isVideo && file.size > 200 * 1024 * 1024) {
      toast.error(`Kích thước video ${file.name} vượt quá giới hạn 200MB.`);
      return false;
    }
    return true;
  }, []);

  const actions = {
    changeSearch: (val: string) => {
      setSearch(val);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changeStatusFilter: (status: MediaStatus | "All") => {
      setStatusFilter(status);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changeTypeFilter: (type: MediaType | "All") => {
      setTypeFilter(type);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    clearFilters: () => {
      setSearch("");
      setStatusFilter("All");
      setTypeFilter("All");
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changePage: (page: number) => setPagination((p) => ({ ...p, page })),
    changeLimit: (limit: number) => setPagination({ page: 1, limit }),

    openUploadDrawer: useCallback(
      (files: File | FileList | File[]) => {
        const fileArray = files instanceof File ? [files] : Array.from(files);

        if (fileArray.length > 50) {
          toast.error(
            "Hệ thống từ chối do vượt quá giới hạn 50 tệp tin cho một lượt tải lên.",
          );
          return;
        }

        const validFiles = fileArray.filter(validateFile);

        if (validFiles.length > 0) {
          const drafts: UploadDraft[] = validFiles.map((file, index) => ({
            id: `draft-${Date.now()}-${index}`,
            file: file,
            previewUrl: URL.createObjectURL(file),
          }));

          setDrawerConfig({
            isOpen: true,
            mode: "upload",
            uploadDrafts: drafts,
            previewUrl: "",
            editingRecord: null,
            isSubmitting: false,
          });
        }
      },
      [validateFile],
    ),

    openEditDrawer: (record: MediaRecord) => {
      setDrawerConfig({
        isOpen: true,
        mode: "edit",
        uploadDrafts: [],
        previewUrl: record.url,
        editingRecord: record,
        isSubmitting: false,
      });
    },

    openViewDrawer: (record: MediaRecord) => {
      setDrawerConfig({
        isOpen: true,
        mode: "view",
        uploadDrafts: [],
        previewUrl: record.url,
        editingRecord: record,
        isSubmitting: false,
      });
    },

    closeDrawer: () => {
      if (
        drawerConfig.mode === "upload" &&
        drawerConfig.uploadDrafts.length > 0
      ) {
        drawerConfig.uploadDrafts.forEach((draft) => {
          URL.revokeObjectURL(draft.previewUrl);
        });
      }
      setDrawerConfig({
        isOpen: false,
        mode: "upload",
        uploadDrafts: [],
        previewUrl: "",
        editingRecord: null,
        isSubmitting: false,
      });
    },

    setPrimaryMedia: async (id: string) => {
      try {
        await axiosClient.patch(`/marketing/media/${id}/primary`);
        toast.success("Đã cập nhật ảnh chính thức!");
        fetchMedia();
      } catch (error: unknown) {
        toast.error(getErrorMessage(error));
      }
    },

    deleteMedia: (id: string) => {
      setDeleteModalConfig({ isOpen: true, mediaId: id });
    },

    closeDeleteModal: () => {
      setDeleteModalConfig({ isOpen: false, mediaId: null });
    },

    handleConfirmDelete: async () => {
      if (deleteModalConfig.mediaId) {
        try {
          await axiosClient.delete(
            `/marketing/media/${deleteModalConfig.mediaId}`,
          );
          toast.success("Đã xóa phương tiện thành công!");
          setDeleteModalConfig({ isOpen: false, mediaId: null });
          fetchMedia();
        } catch (error: unknown) {
          toast.error(getErrorMessage(error));
        }
      }
    },

    replaceMedia: async (id: string, newFile: File) => {
      if (validateFile(newFile)) {
        try {
          const formData = new FormData();
          formData.append("file", newFile);

          await axiosClient.post(`/marketing/media/${id}/replace`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });

          toast.success("Thay thế phương tiện thành công!");
          fetchMedia();
        } catch (error: unknown) {
          toast.error(getErrorMessage(error));
        }
      }
    },

    openCropModal: (record: MediaRecord) => {
      if (record.fileName.toLowerCase().endsWith(".mp4")) {
        toast.error(
          "Hệ thống vô hiệu hóa chức năng cắt ảnh đối với tệp tin video.",
        );
        return;
      }
      setCropModalConfig({ isOpen: true, mediaRecord: record });
    },

    closeCropModal: () => {
      setCropModalConfig({ isOpen: false, mediaRecord: null });
    },

    handleCropSave: async (id: string, newFile: File) => {
      try {
        const formData = new FormData();
        formData.append("file", newFile);

        await axiosClient.post(`/marketing/media/${id}/crop`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        toast.success("Cắt hình ảnh thành công!");
        setCropModalConfig({ isOpen: false, mediaRecord: null });
        fetchMedia();
      } catch (error: unknown) {
        toast.error(getErrorMessage(error));
      }
    },
  };

  const handleDrawerSubmit = async (data: MediaFormData | MediaFormData[]) => {
    setDrawerConfig((prev) => ({ ...prev, isSubmitting: true }));

    try {
      if (
        drawerConfig.mode === "upload" &&
        drawerConfig.uploadDrafts.length > 0
      ) {
        const formArray = data as MediaFormData[];
        const isValid = formArray.every((d) => d.type && d.targetId);

        if (!isValid) {
          toast.error(
            "Vui lòng chọn phân loại và gán đối tượng cho toàn bộ phương tiện.",
          );
          setDrawerConfig((prev) => ({ ...prev, isSubmitting: false }));
          return;
        }

        const formData = new FormData();
        drawerConfig.uploadDrafts.forEach((draft) => {
          formData.append("files", draft.file);
        });

        // handle: Map payload cho Bulk Upload chuẩn xác
        const metadataPayload = formArray.map((form) => ({
          type: form.type,
          targetId: form.targetId,
          altText: form.altText.trim(),
          status: form.status as MediaStatus,
        }));

        formData.append("metadata", JSON.stringify(metadataPayload));

        await axiosClient.post("/marketing/media/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        toast.success(`Tải lên phương tiện thành công!`);
        setDrawerConfig((prev) => ({
          ...prev,
          uploadDrafts: [],
          isOpen: false,
        }));
        fetchMedia();
      } else if (drawerConfig.mode === "edit" && drawerConfig.editingRecord) {
        const singleData = data as MediaFormData;

        if (!singleData.type || !singleData.targetId) {
          toast.error("Vui lòng chọn phân loại và đối tượng được gán.");
          setDrawerConfig((prev) => ({ ...prev, isSubmitting: false }));
          return;
        }

        // handle: Map chuẩn xác các trường cập nhật (đặc biệt là Toggle Status)
        const payload = {
          type: singleData.type,
          targetId: singleData.targetId,
          status: singleData.status as MediaStatus,
          altText: singleData.altText.trim(),
        };

        await axiosClient.patch(
          `/marketing/media/${drawerConfig.editingRecord.id}`,
          payload,
        );

        toast.success("Cập nhật thông tin phương tiện thành công!");
        setDrawerConfig({
          isOpen: false,
          mode: "upload",
          uploadDrafts: [],
          previewUrl: "",
          editingRecord: null,
          isSubmitting: false,
        });
        fetchMedia();
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      setDrawerConfig((prev) => ({ ...prev, isSubmitting: false }));
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
    drawerConfig,
    deleteModalConfig,
    cropModalConfig,
    actions,
    handleDrawerSubmit,
    searchTargets,
    resolveTargetName,
  };
}
