import { useState, useMemo } from "react";
import { toast } from "react-toastify";

// prop
export type TagStatus = "Active" | "Inactive";

export interface Tag {
  id: number;
  name: string;
  description: string;
  status: TagStatus;
}

export interface TagFormData {
  name: string;
  description: string;
  status: TagStatus;
}

// mock data
const INITIAL_TAGS: Tag[] = [
  {
    id: 1,
    name: "Summer Collection",
    description: "Sản phẩm dành cho mùa hè",
    status: "Active",
  },
  { id: 2, name: "New Arrival", description: "Hàng mới về", status: "Active" },
  {
    id: 3,
    name: "Sale",
    description: "Sản phẩm đang giảm giá",
    status: "Active",
  },
  {
    id: 4,
    name: "Winter Collection",
    description: "Sản phẩm dành cho mùa đông",
    status: "Inactive",
  },
  {
    id: 5,
    name: "Limited Edition",
    description: "Phiên bản giới hạn số lượng",
    status: "Active",
  },
];

export function useTagManagement() {
  const [tags, setTags] = useState<Tag[]>(INITIAL_TAGS);
  const [search, setSearch] = useState<string>("");

  // quản lý drawer
  const [drawerConfig, setDrawerConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    editingTag: Tag | null;
  }>({ isOpen: false, mode: "add", editingTag: null });

  // quản lý popup xác nhận xóa
  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    tagId: number | null;
  }>({ isOpen: false, tagId: null });

  // bộ lọc
  const filteredTags = useMemo(() => {
    if (!search.trim()) return tags;
    return tags.filter(
      (t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()),
    );
  }, [tags, search]);

  // nút action
  const actions = {
    changeSearch: (val: string) => setSearch(val),

    openDrawer: (mode: "add" | "edit", tag?: Tag) => {
      setDrawerConfig({
        isOpen: true,
        mode,
        editingTag: tag || null,
      });
    },

    closeDrawer: () => {
      setDrawerConfig({ isOpen: false, mode: "add", editingTag: null });
    },

    toggleStatus: (id: number, currentStatus: TagStatus) => {
      setTags((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                status: currentStatus === "Active" ? "Inactive" : "Active",
              }
            : t,
        ),
      );
      toast.success("Cập nhật trạng thái thành công!");
    },

    deleteSingle: (id: number) => {
      setDeleteConfig({ isOpen: true, tagId: id });
    },
  };

  const handleDrawerSubmit = (data: TagFormData) => {
    if (drawerConfig.mode === "add") {
      const newTag: Tag = {
        id: Date.now(),
        name: data.name,
        description: data.description,
        status: data.status,
      };
      setTags((prev) => [newTag, ...prev]);
      toast.success("Thêm nhãn thành công!");
    } else if (drawerConfig.mode === "edit" && drawerConfig.editingTag) {
      setTags((prev) =>
        prev.map((t) =>
          t.id === drawerConfig.editingTag!.id
            ? {
                ...t,
                name: data.name,
                description: data.description,
                status: data.status,
              }
            : t,
        ),
      );
      toast.success("Cập nhật nhãn thành công!");
    }
    actions.closeDrawer();
  };

  // xác nhận xóa
  const executeDelete = () => {
    if (deleteConfig.tagId !== null) {
      setTags((prev) => prev.filter((t) => t.id !== deleteConfig.tagId));
      toast.success("Đã xóa nhãn thành công!");
    }
    setDeleteConfig({ isOpen: false, tagId: null });
  };

  return {
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
