import { useState, useMemo, useEffect } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

export interface Tag {
  _id: string;
  name: string;
  description: string;
  scope: string;
  bg_color: string;
  text_color: string;
  usage_count: number;
}

export interface TagFormData {
  name: string;
  description: string;
  scope: string;
  bg_color: string;
  text_color: string;
}

// Interface định nghĩa cấu trúc lỗi trả về từ API
export interface ApiError {
  message?: string | string[];
}

export function useTagManagement() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [drawerConfig, setDrawerConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    editingTag: Tag | null;
  }>({ isOpen: false, mode: "add", editingTag: null });

  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    tagId: string | null;
  }>({ isOpen: false, tagId: null });

  useEffect(() => {
    let isMounted = true;
    const fetchTags = async () => {
      try {
        const res = await axiosClient.get("/tags");
        if (isMounted && res.data) {
          setTags(Array.isArray(res.data) ? res.data : res.data.data || []);
        }
      } catch (error) {
        console.error("lỗi khi tải danh sách thẻ:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchTags();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredTags = useMemo(() => {
    return tags.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [tags, search]);

  // Phân trang phía FE (BE trả toàn bộ tag kèm usage_count)
  const totalPages = Math.max(
    Math.ceil(filteredTags.length / pagination.limit),
    1,
  );
  // Xoá tag cuối của trang cuối thì lùi về trang trước, không để trang trống
  const safePage = Math.min(pagination.page, totalPages);
  const currentTags = useMemo(() => {
    const start = (safePage - 1) * pagination.limit;
    return filteredTags.slice(start, start + pagination.limit);
  }, [filteredTags, safePage, pagination.limit]);

  const actions = {
    changeSearch: (val: string) => {
      setSearch(val);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changePage: (page: number) => setPagination((p) => ({ ...p, page })),
    changeLimit: (limit: number) => setPagination({ page: 1, limit }),
    openDrawer: (mode: "add" | "edit", tag?: Tag) => {
      setDrawerConfig({ isOpen: true, mode, editingTag: tag || null });
    },
    closeDrawer: () => {
      setDrawerConfig({ isOpen: false, mode: "add", editingTag: null });
    },
    deleteSingle: (id: string) => {
      setDeleteConfig({ isOpen: true, tagId: id });
    },
  };

  const handleDrawerSubmit = async (data: TagFormData) => {
    try {
      if (drawerConfig.mode === "add") {
        const res = await axiosClient.post("/tags", data);
        if (res.data) {
          setTags((prev) => [res.data, ...prev]);
          setPagination((p) => ({ ...p, page: 1 }));
          toast.success("thêm thẻ thành công!");
        }
      } else if (drawerConfig.mode === "edit" && drawerConfig.editingTag) {
        const res = await axiosClient.patch(
          `/tags/${drawerConfig.editingTag._id}`,
          data,
        );
        if (res.data) {
          setTags((prev) =>
            prev.map((t) =>
              t._id === drawerConfig.editingTag!._id ? res.data : t,
            ),
          );
          toast.success("cập nhật thẻ thành công!");
        }
      }
      actions.closeDrawer();
    } catch (error: unknown) {
      // Ép kiểu error từ unknown về ApiError để truy cập message an toàn
      const err = error as { response?: { data?: ApiError } };
      const msg = err.response?.data?.message || "có lỗi xảy ra khi lưu thẻ";
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
    }
  };

  const executeDelete = async () => {
    if (deleteConfig.tagId !== null) {
      try {
        await axiosClient.delete(`/tags/${deleteConfig.tagId}`);
        setTags((prev) => prev.filter((t) => t._id !== deleteConfig.tagId));
        toast.success("đã xóa thẻ!");
      } catch (error: unknown) {
        // Ép kiểu error từ unknown về ApiError để truy cập message an toàn
        const err = error as { response?: { data?: ApiError } };
        const msg = err.response?.data?.message || "không thể xóa thẻ này";
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      }
    }
    setDeleteConfig({ isOpen: false, tagId: null });
  };

  return {
    tags,
    filteredTags,
    currentTags,
    pagination: {
      page: safePage,
      limit: pagination.limit,
      totalPages,
      totalFiltered: filteredTags.length,
    },
    isLoading,
    search,
    drawerConfig,
    deleteConfig,
    setDeleteConfig,
    actions,
    handleDrawerSubmit,
    executeDelete,
  };
}
