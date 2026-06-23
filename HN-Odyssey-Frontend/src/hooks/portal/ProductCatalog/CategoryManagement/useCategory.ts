import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";
import {
  findNodeInTree,
  flattenVisibleCategories,
  searchCategoriesFlat,
  type CategoryNode,
  type CategoryStatus,
} from "../../../../utils/portal/ProductCatalog/CategoryManagement/categoryTree.utils";

export interface CategoryFormData {
  name: string;
  slug?: string;
  description?: string;
  parentId: string | null;
  status: CategoryStatus;
}

interface CategoryApiResponse {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  is_active?: boolean;
  parent_id?: string | null;
  parentId?: string | null;
  order?: number;
  display_order?: number;
  children?: CategoryApiResponse[];
}

const mapCategoryTree = (node: CategoryApiResponse): CategoryNode => {
  return {
    id: node._id,
    name: node.name,
    slug: node.slug,
    description: node.description,
    status: node.is_active ? "Active" : "Inactive",
    parentId: node.parentId || node.parent_id || null,
    order: node.order || node.display_order || 0,
    children: node.children ? node.children.map(mapCategoryTree) : [],
  };
};

export function useCategory() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [drawerConfig, setDrawerConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    initialData?: CategoryFormData;
    editingId?: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    mode: "add",
    isSubmitting: false,
  });

  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    categoryId: string | null;
    isDeleting: boolean;
  }>({ isOpen: false, categoryId: null, isDeleting: false });

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosClient.get("/categories/admin/tree-view");
      const mappedData = (res.data || []).map(mapCategoryTree);
      setCategories(mappedData);
    } catch (error: unknown) {
      const err = error as { message?: string | string[] };
      const msg = err?.message || "Lỗi khi tải danh mục";
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const visibleCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return flattenVisibleCategories(categories, expandedIds);
    }
    return searchCategoriesFlat(categories, searchQuery);
  }, [categories, expandedIds, searchQuery]);

  const openAddDrawer = useCallback(() => {
    setDrawerConfig({ isOpen: true, mode: "add", isSubmitting: false });
  }, []);

  const openEditDrawer = useCallback(
    (id: string) => {
      const node = findNodeInTree(categories, id);
      if (node) {
        setDrawerConfig({
          isOpen: true,
          mode: "edit",
          editingId: id,
          initialData: {
            name: node.name,
            slug: node.slug || "",
            description: node.description || "",
            parentId: node.parentId,
            status: node.status,
          },
          isSubmitting: false,
        });
      }
    },
    [categories],
  );

  const closeDrawer = useCallback(() => {
    setDrawerConfig((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const saveCategory = useCallback(
    async (data: CategoryFormData) => {
      setDrawerConfig((prev) => ({ ...prev, isSubmitting: true }));
      try {
        const payload = {
          name: data.name,
          slug: data.slug,
          description: data.description,
          parent_id: data.parentId || null,
          is_active: data.status === "Active",
        };

        if (drawerConfig.mode === "add") {
          await axiosClient.post("/categories/create", payload);
          toast.success("Thêm danh mục thành công!");
        } else if (drawerConfig.mode === "edit" && drawerConfig.editingId) {
          await axiosClient.patch(
            `/categories/update/${drawerConfig.editingId}`,
            payload,
          );
          toast.success("Cập nhật danh mục thành công!");
        }

        if (data.parentId) {
          setExpandedIds((prev) => {
            const next = new Set(prev);
            next.add(data.parentId as string);
            return next;
          });
        }

        closeDrawer();
        fetchCategories();
      } catch (error: unknown) {
        const err = error as { message?: string | string[] };
        const msg = err?.message || "Lỗi khi lưu danh mục";
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      } finally {
        setDrawerConfig((prev) => ({ ...prev, isSubmitting: false }));
      }
    },
    [drawerConfig, closeDrawer, fetchCategories],
  );

  const requestDelete = useCallback((id: string) => {
    setDeleteConfig({ isOpen: true, categoryId: id, isDeleting: false });
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteConfig({ isOpen: false, categoryId: null, isDeleting: false });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfig.categoryId || deleteConfig.isDeleting) return;

    setDeleteConfig((prev) => ({ ...prev, isDeleting: true }));
    try {
      await axiosClient.delete(`/categories/delete/${deleteConfig.categoryId}`);
      toast.success("Đã xóa danh mục!");
      cancelDelete();
      fetchCategories();
    } catch (error: unknown) {
      const err = error as { message?: string | string[] };
      const msg = err?.message || "Không thể xóa danh mục này";
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setDeleteConfig((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [deleteConfig, cancelDelete, fetchCategories]);

  const moveCategory = useCallback(
    async (draggedId: string, targetId: string) => {
      if (draggedId === targetId) return;

      const draggedNode = findNodeInTree(categories, draggedId);
      const targetNode = findNodeInTree(categories, targetId);

      if (!draggedNode || !targetNode) return;

      try {
        if (draggedNode.parentId === targetNode.parentId) {
          const parentChildren = targetNode.parentId
            ? findNodeInTree(categories, targetNode.parentId)?.children || []
            : categories;

          const ids = parentChildren.map((c) => c.id);
          const draggedIndex = ids.indexOf(draggedId);
          const targetIndex = ids.indexOf(targetId);

          ids.splice(draggedIndex, 1);
          ids.splice(targetIndex, 0, draggedId);

          const items = ids.map((id, index) => ({ id, order: index }));
          await axiosClient.patch("/categories/reorder", { items });

          toast.success("Đã thay đổi thứ tự!");
        } else {
          await axiosClient.patch(`/categories/update/${draggedId}`, {
            parent_id: targetNode.parentId || null,
          });
          toast.success("Đã chuyển danh mục cha!");
        }

        fetchCategories();
      } catch (error: unknown) {
        const err = error as { message?: string | string[] };
        const msg = err?.message || "Lỗi khi di chuyển danh mục";
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      }
    },
    [categories, fetchCategories],
  );

  return {
    categories,
    visibleCategories,
    searchQuery,
    setSearchQuery,
    expandedIds,
    toggleExpand,
    drawerConfig,
    openAddDrawer,
    openEditDrawer,
    closeDrawer,
    saveCategory,
    deleteConfig,
    requestDelete,
    cancelDelete,
    confirmDelete,
    moveCategory,
    isLoading,
  };
}
