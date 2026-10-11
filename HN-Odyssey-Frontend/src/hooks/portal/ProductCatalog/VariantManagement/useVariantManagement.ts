import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";
import { Resource } from "../../../../types/permissions";
import { Action } from "../../../../types/permissions";
import tokenStorage from "../../../../utils/tokenStorage";

interface UserPayload {
  roles?: string[];
  permissions?: { resource: string; actions: string[] }[];
}

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

// Định nghĩa interface an toàn cho Error từ API (Khắc phục lỗi no-explicit-any)
interface ApiError {
  response?: {
    status?: number;
    data?: {
      message?: string | string[];
    };
  };
  message?: string;
}

export function useVariantManagement() {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [search, setSearch] = useState("");
  const [accessError, setAccessError] = useState<boolean>(false);

  const user = tokenStorage.getUser() as UserPayload | null;
  const hasPermission = (resourceCode: Resource, actionCode: Action) => {
    if (!user || !user.permissions) return false;
    if (user.roles && user.roles.includes("Super Admin")) return true;
    const perm = user.permissions.find((p) => p.resource === resourceCode);
    if (!perm) return false;
    return (
      perm.actions.includes(actionCode) || perm.actions.includes(Action.MANAGE)
    );
  };

  const canCreate = hasPermission(Resource.CATALOG_ATTRIBUTES, Action.CREATE);
  const canUpdate = hasPermission(Resource.CATALOG_ATTRIBUTES, Action.UPDATE);
  const canDelete = hasPermission(Resource.CATALOG_ATTRIBUTES, Action.DELETE);

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
      .then((data) => {
        setAttributes(data);
        // Chuyển setAccessError(false) vào luồng bất đồng bộ (Khắc phục lỗi set-state-in-effect)
        setAccessError(false);
      })
      .catch((error: unknown) => {
        const err = error as ApiError; // Ép kiểu an toàn (Khắc phục lỗi no-explicit-any)
        if (err?.response?.status === 403) {
          setAccessError(true);
          toast.error("Bạn không có quyền xem danh sách thuộc tính!");
        } else {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            "Lỗi tải danh sách thuộc tính";
          toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
        }
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
      const err = error as ApiError; // Ép kiểu an toàn (Khắc phục lỗi no-explicit-any)
      if (err?.response?.status === 403) {
        toast.error("Bạn không có quyền thực hiện thao tác này!");
      } else {
        const msg =
          err?.response?.data?.message || err?.message || "Lỗi lưu dữ liệu";
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      }
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
      const err = error as ApiError; // Ép kiểu an toàn (Khắc phục lỗi no-explicit-any)
      if (err?.response?.status === 403) {
        toast.error("Bạn không có quyền xóa thuộc tính này!");
      } else {
        const msg =
          err?.response?.data?.message || err?.message || "Lỗi xóa dữ liệu";
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      }
      setDeleteConfig((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  return {
    attributes: filteredAttributes,
    search,
    drawerConfig,
    deleteConfig,
    accessError, // Trả về trạng thái lỗi
    actions,
    handleSaveAttribute,
    executeDelete,
    permissions: {
      canCreate,
      canUpdate,
      canDelete,
    },
  };
}
