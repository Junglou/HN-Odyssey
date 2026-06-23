export type CategoryStatus = "Active" | "Inactive";

export interface CategoryNode {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  status: CategoryStatus;
  parentId: string | null;
  order: number;
  children?: CategoryNode[];
}

export interface FlatCategoryNode {
  id: string;
  name: string;
  status: CategoryStatus;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  parentId: string | null;
}

// helper
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

// flatten
export const flattenVisibleCategories = (
  nodes: CategoryNode[],
  expandedIds: Set<string>,
  depth: number = 0,
): FlatCategoryNode[] => {
  let result: FlatCategoryNode[] = [];
  for (const node of nodes) {
    const hasChildren = !!node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);

    result.push({
      id: node.id,
      name: node.name,
      status: node.status,
      depth,
      hasChildren,
      isExpanded,
      parentId: node.parentId,
    });

    if (hasChildren && isExpanded) {
      result = result.concat(
        flattenVisibleCategories(node.children!, expandedIds, depth + 1),
      );
    }
  }
  return result;
};

// search
export const searchCategoriesFlat = (
  nodes: CategoryNode[],
  query: string,
  depth: number = 0,
): FlatCategoryNode[] => {
  let result: FlatCategoryNode[] = [];
  const lowerQuery = query.toLowerCase();

  for (const node of nodes) {
    const isMatch = node.name.toLowerCase().includes(lowerQuery);
    const hasChildren = !!node.children && node.children.length > 0;
    let childResults: FlatCategoryNode[] = [];

    if (hasChildren) {
      childResults = searchCategoriesFlat(node.children!, query, depth + 1);
    }

    if (isMatch || childResults.length > 0) {
      result.push({
        id: node.id,
        name: node.name,
        status: node.status,
        depth,
        hasChildren: childResults.length > 0,
        isExpanded: true,
        parentId: node.parentId,
      });
      result = result.concat(childResults);
    }
  }
  return result;
};
