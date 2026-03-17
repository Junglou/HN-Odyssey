export type CategoryStatus = "Active" | "Inactive";

export interface CategoryNode {
  id: string;
  name: string;
  status: CategoryStatus;
  children?: CategoryNode[];
}

export interface FlatCategoryNode {
  id: string;
  name: string;
  status: CategoryStatus;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

// Tìm kiếm một danh mục dựa trên id trong cấu trúc cây đệ quy
export const findNodeInTree = (
  nodes: CategoryNode[],
  targetId: string,
): CategoryNode | null => {
  for (const node of nodes) {
    if (node.id === targetId) return node;
    if (node.children) {
      const found = findNodeInTree(node.children, targetId);
      if (found) return found;
    }
  }
  return null;
};

// Kiểm tra trùng tên
export const isDuplicateSiblingName = (
  nodes: CategoryNode[],
  nameToCheck: string,
  parentId: string | null,
  excludeId?: string,
): boolean => {
  let siblings: CategoryNode[] = nodes;

  if (parentId) {
    const parentNode = findNodeInTree(nodes, parentId);
    siblings = parentNode?.children ?? [];
  }

  return siblings.some(
    (s) =>
      s.name.toLowerCase() === nameToCheck.toLowerCase() && s.id !== excludeId,
  );
};

// Làm phẳng cây danh mục
export const flattenVisibleCategories = (
  nodes: CategoryNode[],
  expandedIds: Set<string>,
  depth = 0,
): FlatCategoryNode[] => {
  return nodes.reduce<FlatCategoryNode[]>((acc, node) => {
    const hasChildren = !!node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);

    acc.push({
      id: node.id,
      name: node.name,
      status: node.status,
      depth,
      hasChildren,
      isExpanded,
    });

    if (hasChildren && isExpanded) {
      acc.push(
        ...flattenVisibleCategories(node.children!, expandedIds, depth + 1),
      );
    }
    return acc;
  }, []);
};

// làm phẳng khi tìm kiếm, bỏ qua trạng thái đóng mở
export const searchCategoriesFlat = (
  nodes: CategoryNode[],
  searchQuery: string,
  depth = 0,
): FlatCategoryNode[] => {
  return nodes.reduce<FlatCategoryNode[]>((acc, node) => {
    const hasChildren = !!node.children && node.children.length > 0;
    if (node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      acc.push({
        id: node.id,
        name: node.name,
        status: node.status,
        depth,
        hasChildren,
        isExpanded: false,
      });
    }
    if (hasChildren) {
      acc.push(...searchCategoriesFlat(node.children!, searchQuery, depth + 1));
    }
    return acc;
  }, []);
};

// Ép trạng thái con theo cha.
export const cascadeInactive = (nodes: CategoryNode[]): CategoryNode[] => {
  return nodes.map((node) => ({
    ...node,
    status: "Inactive",
    children: node.children ? cascadeInactive(node.children) : undefined,
  }));
};

// Đảm bảo logic kéo thả (cha không thể vào con)
export const checkIsDescendant = (
  nodes: CategoryNode[],
  parentId: string,
  childId: string,
): boolean => {
  const parent = findNodeInTree(nodes, parentId);
  if (!parent || !parent.children) return false;

  const traverse = (children: CategoryNode[]): boolean => {
    for (const c of children) {
      if (c.id === childId) return true;
      if (c.children && traverse(c.children)) return true;
    }
    return false;
  };
  return traverse(parent.children);
};

// Đảm bảo tính hợp lệ danh mục cha
export const removeNodeFromTree = (
  nodes: CategoryNode[],
  draggedId: string,
): { newNodes: CategoryNode[]; draggedNode: CategoryNode | null } => {
  let draggedNode: CategoryNode | null = null;

  const removeRecursive = (list: CategoryNode[]): CategoryNode[] => {
    return list.reduce<CategoryNode[]>((acc, node) => {
      if (node.id === draggedId) {
        draggedNode = node;
        return acc;
      }
      acc.push({
        ...node,
        children: node.children
          ? removeRecursive(node.children)
          : node.children,
      });
      return acc;
    }, []);
  };

  const newNodes = removeRecursive(nodes);
  return { newNodes, draggedNode };
};

// Đảm bảo tính hợp lệ khi chèn vào một vị trí mới
export const insertNodeAfterTarget = (
  nodes: CategoryNode[],
  targetId: string,
  nodeToInsert: CategoryNode,
): CategoryNode[] => {
  return nodes.reduce<CategoryNode[]>((acc, node) => {
    const updatedNode = {
      ...node,
      children: node.children
        ? insertNodeAfterTarget(node.children, targetId, nodeToInsert)
        : node.children,
    };
    acc.push(updatedNode);

    if (node.id === targetId) {
      acc.push(nodeToInsert);
    }
    return acc;
  }, []);
};

// kéo từ dưới lên trên
export const insertNodeBeforeTarget = (
  nodes: CategoryNode[],
  targetId: string,
  nodeToInsert: CategoryNode,
): CategoryNode[] => {
  return nodes.reduce<CategoryNode[]>((acc, node) => {
    if (node.id === targetId) {
      acc.push(nodeToInsert);
    }

    const updatedNode = {
      ...node,
      children: node.children
        ? insertNodeBeforeTarget(node.children, targetId, nodeToInsert)
        : node.children,
    };
    acc.push(updatedNode);

    return acc;
  }, []);
};
