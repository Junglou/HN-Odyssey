import { useState, useMemo, useEffect } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

// types
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

export interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export function useTagManagement() {
  // states
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState("");
  const [drawerConfig, setDrawerConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    editingTag: Tag | null;
  }>({ isOpen: false, mode: "add", editingTag: null });

  // chú ý: đã đổi tagId từ number sang string để khớp với _id của MongoDB
  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    tagId: string | null;
  }>({ isOpen: false, tagId: null });

  // effects: tải dữ liệu từ backend
  useEffect(() => {
    let isMounted = true;
    const fetchTags = async () => {
      try {
        const res = await axiosClient.get("/tags");
        if (isMounted && res.data) {
          // tùy vào format response của backend, thường là mảng trực tiếp hoặc bọc trong data
          setTags(Array.isArray(res.data) ? res.data : res.data.data || []);
        }
      } catch (error) {
        console.error("lỗi khi tải danh sách thẻ:", error);
      }
    };
    fetchTags();
    return () => {
      isMounted = false;
    };
  }, []);

  // derived state: lọc danh sách theo từ khóa tìm kiếm
  const filteredTags = useMemo(() => {
    return tags.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [tags, search]);

  // handlers
  const actions = {
    changeSearch: (val: string) => setSearch(val),

    openDrawer: (mode: "add" | "edit", tag?: Tag) => {
      setDrawerConfig({ isOpen: true, mode, editingTag: tag || null });
    },

    closeDrawer: () => {
      setDrawerConfig({ isOpen: false, mode: "add", editingTag: null });
    },

    // đã xóa toggleStatus vì backend không dùng
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
    } catch (error) {
      const err = error as ApiError;
      toast.error(err.response?.data?.message || "có lỗi xảy ra khi lưu thẻ");
    }
  };

  const executeDelete = async () => {
    if (deleteConfig.tagId !== null) {
      try {
        await axiosClient.delete(`/tags/${deleteConfig.tagId}`);
        setTags((prev) => prev.filter((t) => t._id !== deleteConfig.tagId));
        toast.success("đã xóa thẻ!");
      } catch (error) {
        const err = error as ApiError;
        toast.error(err.response?.data?.message || "không thể xóa thẻ này");
      }
    }
    setDeleteConfig({ isOpen: false, tagId: null });
  };

  return {
    tags,
    filteredTags,
    search,
    drawerConfig,
    deleteConfig,
    setDeleteConfig,
    actions,
    handleDrawerSubmit,
    executeDelete,
  };
}
