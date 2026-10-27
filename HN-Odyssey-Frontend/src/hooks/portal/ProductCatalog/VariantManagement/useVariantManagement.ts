import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";
import { Resource } from "../../../../types/permissions";
import { Action } from "../../../../types/permissions";
import tokenStorage from "../../../../utils/tokenStorage";
import {
  getApiErrorMessage,
  getApiErrorStatus,
} from "../../../../utils/apiError";

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

export function useVariantManagement() {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [accessError, setAccessError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const user = tokenStorage.getUser() as UserPayload | null;
  const hasPermission = (resourceCode: Resource, actionCode: Action) => {
    if (!user || !user.permissions) return false;
    if (user.roles && user.roles.includes("SUPER_ADMIN")) return true;
    const perm = user.permissions.find((p) => p.resource === resourceCode);
    if (!perm) return false;
    return (
      perm.actions.includes(actionCode) || perm.actions.includes(Action.MANAGE)
    );
  };

  const canCreate = hasPermission(Resource.CATALOG_ATTRIBUTES, Action.CREATE);
  const canUpdate = hasPermission(Resource.CATALOG_ATTRIBUTES, Action.UPDATE);
  const canDelete = hasPermission(Resource.CATALOG_ATTRIBUTES, Action.DELETE);
  const canChangeStatus = hasPermission(
    Resource.CATALOG_ATTRIBUTES,
    Action.CHANGE_STATUS,
  );

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
        // axiosClient trả lỗi dạng { status, message, data }, không có error.response
        if (getApiErrorStatus(error) === 403) {
          setAccessError(true);
          toast.error("Bạn không có quyền xem danh sách thuộc tính!");
        } else {
          toast.error(
            getApiErrorMessage(error, "Lỗi tải danh sách thuộc tính"),
          );
        }
      })
      .finally(() => setIsLoading(false));
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

  // Phân trang phía FE (BE trả toàn bộ thuộc tính)
  const totalPages = Math.max(
    Math.ceil(filteredAttributes.length / pagination.limit),
    1,
  );
  // Xoá dòng cuối của trang cuối thì lùi về trang trước, không để trang trống
  const safePage = Math.min(pagination.page, totalPages);
  const currentAttributes = useMemo(() => {
    const start = (safePage - 1) * pagination.limit;
    return filteredAttributes.slice(start, start + pagination.limit);
  }, [filteredAttributes, safePage, pagination.limit]);

  const actions = {
    changeSearch: (val: string) => {
      setSearch(val);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changePage: (page: number) => setPagination((p) => ({ ...p, page })),
    changeLimit: (limit: number) => setPagination({ page: 1, limit }),
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
      // KHÔNG gửi is_active: bật/tắt đi qua /attributes/:id/status (quyền CHANGE_STATUS)
      const { is_active: wantActive, ...payload } = data;
      let attributeId: string | undefined;
      let wasActive = false;

      if (drawerConfig.mode === "add") {
        const res = await axiosClient.post("/attributes", payload);
        attributeId = res.data?._id ?? res.data?.data?._id;
      } else if (
        drawerConfig.mode === "edit" &&
        drawerConfig.editingAttribute
      ) {
        attributeId = drawerConfig.editingAttribute.id;
        wasActive = drawerConfig.editingAttribute.is_active;
        await axiosClient.patch(`/attributes/${attributeId}`, payload);
      }

      const baseMsg =
        drawerConfig.mode === "add"
          ? "Tạo thuộc tính thành công!"
          : "Cập nhật thuộc tính thành công!";

      if (attributeId && wantActive !== wasActive) {
        if (canChangeStatus) {
          await axiosClient.patch(`/attributes/${attributeId}/status`, {
            is_active: wantActive,
          });
          toast.success(baseMsg);
        } else {
          toast.warning(
            `${baseMsg} Bạn không có quyền bật/tắt nên trạng thái được giữ nguyên.`,
          );
        }
      } else {
        toast.success(baseMsg);
      }
      if (drawerConfig.mode === "add") {
        setPagination((p) => ({ ...p, page: 1 }));
      }
      refreshData();
      actions.closeDrawer();
    } catch (error: unknown) {
      if (getApiErrorStatus(error) === 403) {
        toast.error("Bạn không có quyền thực hiện thao tác này!");
      } else {
        toast.error(getApiErrorMessage(error, "Lỗi lưu dữ liệu"));
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
      if (getApiErrorStatus(error) === 403) {
        toast.error("Bạn không có quyền xóa thuộc tính này!");
      } else {
        toast.error(getApiErrorMessage(error, "Lỗi xóa dữ liệu"));
      }
      setDeleteConfig((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  return {
    attributes: currentAttributes,
    pagination: {
      page: safePage,
      limit: pagination.limit,
      totalPages,
      totalFiltered: filteredAttributes.length,
    },
    isLoading,
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
      canChangeStatus,
    },
  };
}
