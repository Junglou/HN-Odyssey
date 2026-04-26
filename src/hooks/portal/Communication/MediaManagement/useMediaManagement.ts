import { useState, useRef, useMemo, useCallback } from "react";
import { toast } from "react-toastify";

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

const INITIAL_MEDIA: MediaRecord[] = [
  {
    id: "img-1",
    url: "https://placehold.co/400x300/ffedd5/ea580c?text=Orange+Jacket",
    fileName: "Orange_Jacket.jpg",
    type: "Product",
    targetId: "CWT-001",
    status: "Published",
    isPrimary: true,
    altText: "Orange winter jacket",
    size: 1024000,
  },
  {
    id: "img-2",
    url: "https://placehold.co/400x300/fef08a/ca8a04?text=Yellow+Jacket",
    fileName: "Yellow_Jacket.jpg",
    type: "Product",
    targetId: "SHR-012",
    status: "Published",
    isPrimary: false,
    altText: "Yellow winter jacket",
    size: 2048000,
  },
  {
    id: "img-3",
    url: "https://placehold.co/400x300/e0f2fe/0284c7?text=Winter+Category",
    fileName: "Category_Winter.jpg",
    type: "Category",
    targetId: "c1",
    status: "Published",
    isPrimary: false,
    altText: "Winter collection category",
    size: 1500000,
  },
  {
    id: "vid-1",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    fileName: "Sample_Video.mp4",
    type: "Product",
    targetId: "CWT-001",
    status: "Published",
    isPrimary: false,
    altText: "Sample product video",
    size: 15400000,
  },
];

export function useMediaManagement() {
  const [records, setRecords] = useState<MediaRecord[]>(INITIAL_MEDIA);
  const nextIdCounter = useRef<number>(4);

  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<MediaStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<MediaType | "All">("All");
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  // thay đổi selectedFile đơn thành mảng uploadDrafts để hỗ trợ tải lên nhiều file
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

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchStatus =
        statusFilter === "All" || record.status === statusFilter;
      const matchType = typeFilter === "All" || record.type === typeFilter;
      const matchSearch =
        !normalizedSearch ||
        record.fileName.toLowerCase().includes(normalizedSearch) ||
        record.altText.toLowerCase().includes(normalizedSearch);

      return matchStatus && matchType && matchSearch;
    });
  }, [records, search, statusFilter, typeFilter]);

  const totalPages = Math.ceil(filteredRecords.length / pagination.limit);
  const startIndex = (pagination.page - 1) * pagination.limit;
  const currentRecords = filteredRecords.slice(
    startIndex,
    startIndex + pagination.limit,
  );

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

    // hỗ trợ nhận một mảng các file thay vì một file duy nhất
    openUploadDrawer: useCallback(
      (files: File | FileList | File[]) => {
        // chuyển đổi an toàn mọi đầu vào thành mảng tiêu chuẩn
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
      // thu hồi url của toàn bộ các file tạm trong mảng tải lên
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

    setPrimaryMedia: (id: string) => {
      setRecords((prev) => {
        const targetMedia = prev.find((img) => img.id === id);

        if (!targetMedia || !targetMedia.targetId) {
          toast.error(
            "Vui lòng gán phương tiện cho một Sản phẩm/Danh mục trước khi đặt làm ảnh chính.",
          );
          return prev;
        }

        if (targetMedia.fileName.toLowerCase().endsWith(".mp4")) {
          toast.error(
            "Hệ thống vô hiệu hóa chức năng đặt ảnh đại diện đối với tệp tin video.",
          );
          return prev;
        }

        return prev.map((img) => {
          if (img.targetId === targetMedia.targetId) {
            return {
              ...img,
              isPrimary: img.id === id,
            };
          }
          return img;
        });
      });
      toast.success("Đã cập nhật ảnh chính thức!");
    },

    deleteMedia: (id: string) => {
      setDeleteModalConfig({ isOpen: true, mediaId: id });
    },

    closeDeleteModal: () => {
      setDeleteModalConfig({ isOpen: false, mediaId: null });
    },

    handleConfirmDelete: () => {
      if (deleteModalConfig.mediaId) {
        setRecords((prev) =>
          prev.filter((img) => img.id !== deleteModalConfig.mediaId),
        );
        toast.success("Đã xóa phương tiện thành công!");
        setDeleteModalConfig({ isOpen: false, mediaId: null });
      }
    },

    replaceMedia: (id: string, newFile: File) => {
      if (validateFile(newFile)) {
        const newUrl = URL.createObjectURL(newFile);
        setRecords((prev) =>
          prev.map((img) =>
            img.id === id
              ? {
                  ...img,
                  url: newUrl,
                  fileName: newFile.name,
                  size: newFile.size,
                }
              : img,
          ),
        );
        toast.success("Thay thế phương tiện thành công!");
      }
    },

    openCropModal: (record: MediaRecord) => {
      if (record.fileName.toLowerCase().endsWith(".mp4")) {
        toast.error(
          "Hệ thống vô hiệu hóa chức năng cắt ảnh đối với tệp tin video.",
        );
        return;
      }

      setCropModalConfig({
        isOpen: true,
        mediaRecord: record,
      });
    },

    closeCropModal: () => {
      setCropModalConfig({
        isOpen: false,
        mediaRecord: null,
      });
    },

    handleCropSave: (id: string, newFile: File, newUrl: string) => {
      setRecords((prev) =>
        prev.map((img) =>
          img.id === id
            ? {
                ...img,
                url: newUrl,
                fileName: `cropped_${newFile.name}`,
                size: newFile.size,
              }
            : img,
        ),
      );
      toast.success("Cắt hình ảnh thành công!");
      setCropModalConfig({ isOpen: false, mediaRecord: null });
    },
  };

  // cập nhật hàm submit để hỗ trợ dạng dữ liệu mảng
  const handleDrawerSubmit = (data: MediaFormData | MediaFormData[]) => {
    setDrawerConfig((prev) => ({ ...prev, isSubmitting: true }));

    try {
      if (
        drawerConfig.mode === "upload" &&
        drawerConfig.uploadDrafts.length > 0
      ) {
        const formArray = data as MediaFormData[];

        // kiểm tra điều kiện an toàn cho toàn bộ mảng dữ liệu
        const isValid = formArray.every((d) => d.type && d.targetId);
        if (!isValid) {
          toast.error(
            "Vui lòng chọn phân loại và gán đối tượng cho toàn bộ phương tiện.",
          );
          setDrawerConfig((prev) => ({ ...prev, isSubmitting: false }));
          return;
        }

        const newRecords: MediaRecord[] = drawerConfig.uploadDrafts.map(
          (draft, index) => ({
            id: `img-${nextIdCounter.current + index}`,
            url: draft.previewUrl,
            fileName: draft.file.name,
            size: draft.file.size,
            type: formArray[index].type as MediaType,
            targetId: formArray[index].targetId,
            status: formArray[index].status,
            altText: formArray[index].altText.trim(),
            isPrimary: false,
          }),
        );

        nextIdCounter.current += newRecords.length;
        setRecords((prev) => [...newRecords, ...prev]);
        setPagination((p) => ({ ...p, page: 1 }));
        toast.success(`Tải lên ${newRecords.length} phương tiện thành công!`);

        setDrawerConfig((prev) => ({ ...prev, uploadDrafts: [] }));
      } else if (drawerConfig.mode === "edit" && drawerConfig.editingRecord) {
        const singleData = data as MediaFormData;

        if (!singleData.type || !singleData.targetId) {
          toast.error("Vui lòng chọn phân loại và đối tượng được gán.");
          setDrawerConfig((prev) => ({ ...prev, isSubmitting: false }));
          return;
        }

        // Kiểm tra xem người dùng có thay đổi đối tượng gán (targetId) hoặc loại (type) không
        const isTargetChanged =
          singleData.targetId !== drawerConfig.editingRecord.targetId ||
          singleData.type !== drawerConfig.editingRecord.type;
        // Kiểm tra xem ảnh đang sửa có đang là Primary hay không
        const isCurrentlyPrimary = drawerConfig.editingRecord.isPrimary;

        setRecords((prev) =>
          prev.map((img) => {
            if (img.id === drawerConfig.editingRecord!.id) {
              return {
                ...img,
                type: singleData.type as MediaType,
                targetId: singleData.targetId,
                status: singleData.status,
                altText: singleData.altText.trim(),
              };
            }
            if (
              isTargetChanged &&
              isCurrentlyPrimary &&
              img.targetId === singleData.targetId &&
              img.type === singleData.type
            ) {
              return { ...img, isPrimary: false };
            }

            return img;
          }),
        );
        toast.success("Cập nhật thông tin phương tiện thành công!");
      }
      setDrawerConfig({
        isOpen: false,
        mode: "upload",
        uploadDrafts: [],
        previewUrl: "",
        editingRecord: null,
        isSubmitting: false,
      });
    } catch {
      toast.error("Đã xảy ra lỗi khi lưu dữ liệu.");
      setDrawerConfig((prev) => ({ ...prev, isSubmitting: false }));
    }
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
    drawerConfig,
    deleteModalConfig,
    cropModalConfig,
    actions,
    handleDrawerSubmit,
  };
}
