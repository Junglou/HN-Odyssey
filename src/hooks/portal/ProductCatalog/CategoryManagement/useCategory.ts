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

  // lưu trữ id của các danh mục đang mở
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(["c2", "c2-1", "c3", "c3-1"]),
  );

  // quản lý trạng thái đóng mở
  const [drawerConfig, setDrawerConfig] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    initialData?: CategoryFormData;
    editingId?: string;
    isSubmitting: boolean;
  }>({ isOpen: false, mode: "add", isSubmitting: false });

  // xác nhận xóa
  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    categoryId: string | null;
    isDeleting: boolean;
  }>({ isOpen: false, categoryId: null, isDeleting: false });

  // tính toán và định dạng lại mảng danh mục thành mảng một chiều
  const visibleCategories = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery) {
      return searchCategoriesFlat(categories, normalizedQuery);
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

  // hàm tím kiếm danh mục
  const findNodeAndParent = useCallback(function search(
    nodes: CategoryNode[],
    targetId: string,
    parentId: string | null = null,
  ): { node: CategoryNode; parentId: string | null } | null {
    for (const node of nodes) {
      if (node.id === targetId) return { node, parentId };
      if (node.children) {
        const found = search(node.children, targetId, node.id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const openAddDrawer = useCallback(() => {
    setDrawerConfig({ isOpen: true, mode: "add", isSubmitting: false });
  }, []);

  const openEditDrawer = useCallback(
    (id: string) => {
      // sử dụng hàm tìm kiếm dùng chung
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
          isSubmitting: false,
        });
      }
    },
    [categories, findNodeAndParent],
  );

  const closeDrawer = useCallback(() => {
    setDrawerConfig((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const saveCategory = useCallback(
    async (formData: CategoryFormData) => {
      // kiểm tra trùng tên cùng cấp trước khi thêm hoặc sửa
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

      const currentMode = drawerConfig.mode;
      const currentEditingId = drawerConfig.editingId;
      setDrawerConfig((prev) => ({ ...prev, isSubmitting: true }));

      try {
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (currentMode === "add") {
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
        } else if (currentMode === "edit" && currentEditingId) {
          // cắt danh mục ra khỏi cây hiện tại để chuẩn bị dán vào vị trí mới nếu có thay đổi thư mục cha
          const { newNodes, draggedNode } = removeNodeFromTree(
            categories,
            currentEditingId,
          );

          if (!draggedNode) return;

          // cập nhật tên và trạng thái mới cho danh mục vừa cắt
          const updatedNode: CategoryNode = {
            ...draggedNode,
            name: formData.name.trim(),
            status: formData.status,
            children:
              formData.status === "Inactive" && draggedNode.children
                ? cascadeInactive(draggedNode.children)
                : draggedNode.children,
          };

          // kiểm tra xem danh mục có được chọn vào một thư mục cha mới hay không
          if (!formData.parentId) {
            setCategories([...newNodes, updatedNode]);
          } else {
            // nếu có thư mục cha mới thì duyệt cây và nhét danh mục vào đúng vị trí của cha đó
            const insertRecursive = (nodes: CategoryNode[]): CategoryNode[] => {
              return nodes.map((n) => {
                if (n.id === formData.parentId) {
                  return {
                    ...n,
                    children: [...(n.children ?? []), updatedNode],
                  };
                }
                if (n.children)
                  return { ...n, children: insertRecursive(n.children) };
                return n;
              });
            };
            setCategories(insertRecursive(newNodes));

            setExpandedIds((prev) => {
              const next = new Set(prev);
              next.add(formData.parentId!);
              return next;
            });
          }

          toast.success("Đã cập nhật danh mục!");
        }

        setDrawerConfig({ isOpen: false, mode: "add", isSubmitting: false });
      } catch {
        toast.error("Đã xảy ra lỗi trong quá trình lưu dữ liệu.");
        setDrawerConfig((prev) => ({ ...prev, isSubmitting: false }));
      }
    },
    [categories, drawerConfig],
  );

  const requestDelete = useCallback((id: string) => {
    setDeleteConfig({ isOpen: true, categoryId: id, isDeleting: false });
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteConfig({ isOpen: false, categoryId: null, isDeleting: false });
  }, []);

  const confirmDelete = useCallback(async () => {
    const idToDelete = deleteConfig.categoryId;
    if (!idToDelete) return;
    if (deleteConfig.isDeleting) return;

    // logic kiểm tra xem danh mục có con hay không
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

    setDeleteConfig((prev) => ({ ...prev, isDeleting: true }));

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

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

      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(idToDelete);
        return next;
      });

      setDeleteConfig({ isOpen: false, categoryId: null, isDeleting: false });
      toast.success("Đã xóa danh mục thành công!");
    } catch {
      toast.error("Đã xảy ra lỗi trong quá trình xóa.");
      setDeleteConfig((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [categories, deleteConfig, cancelDelete]);

  // logic kéo thả sắp xếp vị trí
  const moveCategory = useCallback(
    (draggedId: string, targetId: string) => {
      // chặn kéo cha bỏ vào con
      if (checkIsDescendant(categories, draggedId, targetId)) {
        toast.error(
          "Cannot move a parent category into one of its own subcategories!",
        );
        return;
      }

      // kiểm tra trùng lặp
      const draggedInfo = findNodeAndParent(categories, draggedId);
      const targetInfo = findNodeAndParent(categories, targetId);

      if (!draggedInfo || !targetInfo) return;

      // chặn danh mục trùng tên di chuyển cùng cấp
      if (
        isDuplicateSiblingName(
          categories,
          draggedInfo.node.name,
          targetInfo.parentId,
          draggedId,
        )
      ) {
        toast.error(
          "Cannot move category because a category with the same name already exists at the target location!",
        );
        return;
      }

      let isDraggingUp = false;
      if (draggedInfo.parentId === targetInfo.parentId) {
        const parentChildren = targetInfo.parentId
          ? findNodeAndParent(categories, targetInfo.parentId)?.node.children ||
            []
          : categories;

        const dIndex = parentChildren.findIndex((c) => c.id === draggedId);
        const tIndex = parentChildren.findIndex((c) => c.id === targetId);
        isDraggingUp = dIndex > tIndex;
      }

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
    [categories, findNodeAndParent],
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
