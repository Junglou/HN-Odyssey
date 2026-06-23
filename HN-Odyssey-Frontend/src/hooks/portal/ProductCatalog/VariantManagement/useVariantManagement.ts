import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

export interface AttributeValue {
  label: string;
  value: string;
  meta?: string;
}

export interface Attribute {
  id: string;
  name: string;
  code: string;
  display_type: string;
  description?: string;
  values: AttributeValue[];
  is_active: boolean;
}

export interface AttributeFormData {
  name: string;
  code: string;
  display_type: string;
  description?: string;
  values: AttributeValue[];
  is_active: boolean;
}

export function useVariantManagement() {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [search, setSearch] = useState("");
  const [drawerConfig, setDrawerConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    editingAttribute: Attribute | null;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    mode: "add",
    editingAttribute: null,
    isSubmitting: false,
  });
  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    attributeId: string | null;
    isDeleting: boolean;
  }>({ isOpen: false, attributeId: null, isDeleting: false });

  const fetchAttributesData = async () => {
    const res = await axiosClient.get("/attributes");
    const data = res.data?.data || res.data || [];

    return data.map(
      (item: {
        _id: string;
        name: string;
        code: string;
        display_type: string;
        description?: string;
        values?: AttributeValue[];
        is_active?: boolean;
      }) => ({
        id: item._id,
        name: item.name,
        code: item.code,
        display_type: item.display_type,
        description: item.description,
        values: item.values || [],
        is_active: item.is_active ?? true,
      }),
    );
  };

  const refreshData = useCallback(() => {
    fetchAttributesData()
      .then((data) => setAttributes(data))
      .catch((error: unknown) => {
        // Ép kiểu error để lấy message một cách an toàn
        const err = error as { message?: string | string[] };
        const msg = err?.message || "Lỗi tải danh sách thuộc tính";
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      });
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const filteredAttributes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return attributes;

    return attributes.filter(
      (attr) =>
        attr.name.toLowerCase().includes(normalizedSearch) ||
        attr.code.toLowerCase().includes(normalizedSearch) ||
        attr.values.some(
          (v) =>
            v.label.toLowerCase().includes(normalizedSearch) ||
            v.value.toLowerCase().includes(normalizedSearch),
        ),
    );
  }, [search, attributes]);

  const actions = {
    changeSearch: (val: string) => setSearch(val),
    openDrawer: (mode: "add" | "edit", attribute?: Attribute) => {
      setDrawerConfig({
        isOpen: true,
        mode,
        editingAttribute: attribute || null,
        isSubmitting: false,
      });
    },
    closeDrawer: () => {
      setDrawerConfig({
        isOpen: false,
        mode: "add",
        editingAttribute: null,
        isSubmitting: false,
      });
    },
    openDeleteModal: (id: string) => {
      setDeleteConfig({ isOpen: true, attributeId: id, isDeleting: false });
    },
    closeDeleteModal: () => {
      setDeleteConfig({ isOpen: false, attributeId: null, isDeleting: false });
    },
  };

  const handleSaveAttribute = async (data: AttributeFormData) => {
    setDrawerConfig((prev) => ({ ...prev, isSubmitting: true }));
    try {
      if (drawerConfig.mode === "add") {
        await axiosClient.post("/attributes", data);
        toast.success("Tạo thuộc tính thành công!");
      } else if (
        drawerConfig.mode === "edit" &&
        drawerConfig.editingAttribute
      ) {
        await axiosClient.patch(
          `/attributes/${drawerConfig.editingAttribute.id}`,
          data,
        );
        toast.success("Cập nhật thuộc tính thành công!");
      }
      refreshData();
      actions.closeDrawer();
    } catch (error: unknown) {
      const err = error as { message?: string | string[] };
      const msg = err?.message || "Lỗi lưu dữ liệu";
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      setDrawerConfig((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const executeDelete = async () => {
    if (!deleteConfig.attributeId) return;
    setDeleteConfig((prev) => ({ ...prev, isDeleting: true }));
    try {
      await axiosClient.delete(`/attributes/${deleteConfig.attributeId}`);
      toast.success("Đã xóa thuộc tính!");
      refreshData();
      actions.closeDeleteModal();
    } catch (error: unknown) {
      const err = error as { message?: string | string[] };
      const msg = err?.message || "Lỗi xóa dữ liệu";
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      setDeleteConfig((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  return {
    attributes: filteredAttributes,
    search,
    drawerConfig,
    deleteConfig,
    actions,
    handleSaveAttribute,
    executeDelete,
  };
}
