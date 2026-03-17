import { useState, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import {
  findNodeInTree,
  isDuplicateSiblingName,
  flattenVisibleCategories,
  searchCategoriesFlat,
  cascadeInactive,
  checkIsDescendant,
  removeNodeFromTree,
  insertNodeAfterTarget,
  insertNodeBeforeTarget,
  type CategoryNode,
  type CategoryStatus,
} from "../../../../utils/portal/ProductCatalog/CategoryManagement/categoryTree.utils";

export interface CategoryFormData {
  name: string;
  parentId: string | null;
  status: CategoryStatus;
}

const INITIAL_CATEGORIES: CategoryNode[] = [
  { id: "c1", name: "Equipment", status: "Active" },
  {
    id: "c2",
    name: "Men",
    status: "Active",
    children: [
      {
        id: "c2-1",
        name: "Clothing",
        status: "Inactive",
        children: [
          { id: "c2-1-1", name: "Jackets", status: "Inactive" },
          { id: "c2-1-2", name: "Shirts", status: "Active" },
        ],
      },
    ],
  },
  {
    id: "c3",
    name: "Women",
    status: "Active",
    children: [
      {
        id: "c3-1",
        name: "Clothing",
        status: "Inactive",
        children: [
          { id: "c3-1-1", name: "Jackets", status: "Active" },
          { id: "c3-1-2", name: "Shirts", status: "Inactive" },
        ],
      },
    ],
  },
];

export const useCategory = () => {
  const [categories, setCategories] =
    useState<CategoryNode[]>(INITIAL_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState("");

  // Lưu trữ id của các danh mục đang được mở rộng để điều khiển hiển thị cây
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(["c2", "c2-1", "c3", "c3-1"]),
  );

  const [drawerConfig, setDrawerConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    initialData?: CategoryFormData;
    editingId?: string;
  }>({ isOpen: false, mode: "add" });

  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    categoryId: string | null;
  }>({ isOpen: false, categoryId: null });

  // Tự động tính toán lại danh sách hiển thị có thay đổi
  const visibleCategories = useMemo(() => {
    if (searchQuery.trim()) {
      return searchCategoriesFlat(categories, searchQuery);
    }
    return flattenVisibleCategories(categories, expandedIds);
  }, [categories, expandedIds, searchQuery]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openAddDrawer = useCallback(() => {
    setDrawerConfig({ isOpen: true, mode: "add" });
  }, []);

  const openEditDrawer = useCallback(
    (id: string) => {
      const findNodeAndParent = (
        nodes: CategoryNode[],
        targetId: string,
        parentId: string | null = null,
      ): { node: CategoryNode; parentId: string | null } | null => {
        for (const node of nodes) {
          if (node.id === targetId) return { node, parentId };
          if (node.children) {
            const found = findNodeAndParent(node.children, targetId, node.id);
            if (found) return found;
          }
        }
        return null;
      };

      const found = findNodeAndParent(categories, id);
      if (found) {
        setDrawerConfig({
          isOpen: true,
          mode: "edit",
          editingId: id,
          initialData: {
            name: found.node.name,
            status: found.node.status,
            parentId: found.parentId,
          },
        });
      }
    },
    [categories],
  );

  const closeDrawer = useCallback(() => {
    setDrawerConfig((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const saveCategory = useCallback(
    (formData: CategoryFormData) => {
      if (
        isDuplicateSiblingName(
          categories,
          formData.name.trim(),
          formData.parentId,
          drawerConfig.editingId,
        )
      ) {
        toast.error("Name already taken. Please choose a different name!");
        return;
      }

      if (drawerConfig.mode === "add") {
        const newNode: CategoryNode = {
          id: crypto.randomUUID(),
          name: formData.name.trim(),
          status: formData.status,
        };

        if (!formData.parentId) {
          setCategories((prev) => [...prev, newNode]);
        } else {
          const addRecursive = (nodes: CategoryNode[]): CategoryNode[] => {
            return nodes.map((n) => {
              if (n.id === formData.parentId) {
                return { ...n, children: [...(n.children ?? []), newNode] };
              }
              if (n.children)
                return { ...n, children: addRecursive(n.children) };
              return n;
            });
          };
          setCategories((prev) => addRecursive(prev));

          setExpandedIds((prev) => {
            const next = new Set(prev);
            next.add(formData.parentId!);
            return next;
          });
        }
        toast.success("Đã thêm danh mục mới!");
      } else if (drawerConfig.mode === "edit" && drawerConfig.editingId) {
        const editRecursive = (nodes: CategoryNode[]): CategoryNode[] => {
          return nodes.map((n) => {
            if (n.id === drawerConfig.editingId) {
              const updatedChildren =
                formData.status === "Inactive" && n.children
                  ? cascadeInactive(n.children)
                  : n.children;

              return {
                ...n,
                name: formData.name.trim(),
                status: formData.status,
                children: updatedChildren,
              };
            }
            if (n.children)
              return { ...n, children: editRecursive(n.children) };
            return n;
          });
        };

        setCategories((prev) => editRecursive(prev));
        toast.success("Đã cập nhật danh mục!");
      }

      closeDrawer();
    },
    [categories, drawerConfig, closeDrawer],
  );

  const requestDelete = useCallback((id: string) => {
    setDeleteConfig({ isOpen: true, categoryId: id });
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteConfig({ isOpen: false, categoryId: null });
  }, []);

  const confirmDelete = useCallback(() => {
    const idToDelete = deleteConfig.categoryId;
    if (!idToDelete) return;

    const nodeToDelete = findNodeInTree(categories, idToDelete);
    if (
      nodeToDelete &&
      nodeToDelete.children &&
      nodeToDelete.children.length > 0
    ) {
      toast.error(
        "Cannot delete category with subcategories. Please delete subcategories first!",
      );
      cancelDelete();
      return;
    }

    const deleteRecursive = (nodes: CategoryNode[]): CategoryNode[] => {
      return nodes
        .filter((n) => n.id !== idToDelete)
        .map((n) => {
          if (n.children)
            return { ...n, children: deleteRecursive(n.children) };
          return n;
        });
    };

    setCategories((prev) => deleteRecursive(prev));
    cancelDelete();
    toast.success("Đã xóa danh mục thành công!");
  }, [categories, deleteConfig.categoryId, cancelDelete]);

  const moveCategory = useCallback(
    (draggedId: string, targetId: string) => {
      if (checkIsDescendant(categories, draggedId, targetId)) {
        toast.error(
          "Không thể kéo danh mục cha vào bên trong nhánh con của chính nó!",
        );
        return;
      }

      const draggedIndex = visibleCategories.findIndex(
        (c) => c.id === draggedId,
      );
      const targetIndex = visibleCategories.findIndex((c) => c.id === targetId);
      const isDraggingUp = draggedIndex > targetIndex;
      const { newNodes, draggedNode } = removeNodeFromTree(
        categories,
        draggedId,
      );
      if (!draggedNode) return;

      const finalNodes = isDraggingUp
        ? insertNodeBeforeTarget(newNodes, targetId, draggedNode)
        : insertNodeAfterTarget(newNodes, targetId, draggedNode);

      setCategories(finalNodes);
      toast.success("Đã thay đổi vị trí hiển thị!");
    },
    [categories, visibleCategories],
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
  };
};
