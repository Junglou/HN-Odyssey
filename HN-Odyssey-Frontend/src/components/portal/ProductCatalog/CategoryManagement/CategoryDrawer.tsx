import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import "./CategoryDrawer.css";
import {
  BackArrowIcon,
  FilterIcon,
  FolderIcon,
  SearchIcon,
} from "../../../../assets/icons/CategoryIcons";
import { ChevronDownIcon } from "../../../../assets/icons/HeaderIcons";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import type {
  CategoryNode,
  CategoryStatus,
} from "../../../../utils/portal/ProductCatalog/CategoryManagement/categoryTree.utils";

export interface CategoryFormData {
  name: string;
  slug?: string;
  description?: string;
  parentId: string | null;
  status: CategoryStatus;
}

interface CategoryDrawerProps {
  isOpen: boolean;
  mode: "add" | "edit";
  initialData?: CategoryFormData;
  categories: CategoryNode[];
  editingId?: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSave: (data: CategoryFormData) => void;
}

export default function CategoryDrawer({
  isOpen,
  mode,
  initialData,
  categories,
  editingId,
  isSubmitting,
  onClose,
  onSave,
}: CategoryDrawerProps) {
  // states
  const [formData, setFormData] = useState<CategoryFormData>(
    initialData && mode === "edit"
      ? {
          name: initialData.name,
          slug: initialData.slug || "",
          description: initialData.description || "",
          parentId: initialData.parentId,
          status: initialData.status,
        }
      : {
          name: "",
          slug: "",
          description: "",
          parentId: null,
          status: "Active",
        },
  );

  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const treeRef = useRef<HTMLDivElement>(null);
  const [expandedDropdownIds, setExpandedDropdownIds] = useState<Set<string>>(
    new Set(categories.map((c) => c.id)),
  );

  // hooks
  useClickOutside(treeRef, () => {
    setIsTreeOpen(false);
    setSearchTerm("");
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isSubmitting]);

  // memos
  const { categoryMap, parentMap } = useMemo(() => {
    const cMap = new Map<string, CategoryNode>();
    const pMap = new Map<string, string | null>();
    const walk = (nodes: CategoryNode[], parentId: string | null = null) => {
      for (const node of nodes) {
        cMap.set(node.id, node);
        pMap.set(node.id, parentId);
        if (node.children) walk(node.children, node.id);
      }
    };
    walk(categories);
    return { categoryMap: cMap, parentMap: pMap };
  }, [categories]);

  const hiddenNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (mode === "edit" && editingId) {
      ids.add(editingId);
      const findDescendants = (parentId: string) => {
        const node = categoryMap.get(parentId);
        if (node && node.children) {
          node.children.forEach((c) => {
            ids.add(c.id);
            findDescendants(c.id);
          });
        }
      };
      findDescendants(editingId);
    }
    return ids;
  }, [mode, editingId, categoryMap]);

  // helpers
  const getCategoryPath = useCallback(
    (id: string | null): string => {
      if (!id) return "None (Root Category)";

      let path = "";
      let currentId: string | null = id;

      while (currentId) {
        const node = categoryMap.get(currentId);
        if (!node) break;
        path = path ? `${node.name} > ${path}` : node.name;
        currentId = parentMap.get(currentId) || null;
      }

      return path;
    },
    [categoryMap, parentMap],
  );

  // memos
  const filteredSearchNodes = useMemo(() => {
    if (!searchTerm.trim()) return [];

    const results: { id: string; node: CategoryNode; path: string }[] = [];
    const searchLower = searchTerm.toLowerCase();

    categoryMap.forEach((node, id) => {
      if (hiddenNodeIds.has(id)) return;

      if (node.name.toLowerCase().includes(searchLower)) {
        results.push({
          id,
          node,
          path: getCategoryPath(id),
        });
      }
    });

    return results;
  }, [searchTerm, categoryMap, hiddenNodeIds, getCategoryPath]);

  // helpers
  const generateSlug = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^\w-]/g, "");
  };

  // handlers
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData((prev) => {
      const oldName = prev.name;
      const oldSlug = prev.slug || "";
      let newSlug = oldSlug;

      if (!oldSlug || oldSlug === generateSlug(oldName)) {
        newSlug = generateSlug(val);
      }

      return { ...prev, name: val, slug: newSlug };
    });
  };

  const handleSave = () => {
    if (!formData.name.trim() || isSubmitting) return;
    onSave(formData);
  };

  if (!isOpen) return null;

  // variables
  const selectedParentNode = formData.parentId
    ? (categoryMap.get(formData.parentId) ?? null)
    : null;
  const isParentInactive = selectedParentNode?.status === "Inactive";
  const isFormValid = formData.name.trim().length > 0;

  // render
  const renderTreeNodes = (
    nodes: CategoryNode[],
    level: number = 0,
    parentPath: string = "",
  ) => {
    return nodes.map((node) => {
      if (hiddenNodeIds.has(node.id)) return null;

      const hasChildren = !!node.children && node.children.length > 0;
      const isSelected = formData.parentId === node.id;
      const currentPath = parentPath
        ? `${parentPath} > ${node.name}`
        : node.name;
      const isExpanded = expandedDropdownIds.has(node.id);

      return (
        <div key={node.id}>
          <div
            className={`cd-tree-node cd-depth-${level} ${isSelected ? "selected" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              const clickedNode = categoryMap.get(node.id);
              const forceInactive = clickedNode?.status === "Inactive";
              setFormData((prev) => ({
                ...prev,
                parentId: node.id,
                status: forceInactive ? "Inactive" : prev.status,
              }));
              setIsTreeOpen(false);
              setSearchTerm("");
            }}
          >
            <div className="cd-tree-toggle-wrapper">
              <div
                className={`cd-tree-toggle ${hasChildren ? "clickable" : ""} ${isExpanded ? "expanded" : "collapsed"}`}
                onClick={(e) => {
                  if (!hasChildren) return;
                  e.stopPropagation();
                  setExpandedDropdownIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  });
                }}
              >
                {hasChildren ? (
                  <ChevronDownIcon />
                ) : (
                  <span className="cd-empty-space-16"></span>
                )}
              </div>
              <div className="cd-folder-icon">
                <FolderIcon />
              </div>
            </div>

            <span className="cd-tree-path">{currentPath}</span>

            {isSelected && <span className="cd-check-icon">✓</span>}
          </div>
          {hasChildren &&
            isExpanded &&
            renderTreeNodes(node.children ?? [], level + 1, currentPath)}
        </div>
      );
    });
  };

  return (
    <>
      <div
        className="cd-overlay"
        onClick={!isSubmitting ? onClose : undefined}
      ></div>
      <div className="cd-drawer">
        <div className="cd-header">
          <button
            type="button"
            className="cd-back-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <BackArrowIcon />
          </button>
          <h2 className="cd-title">
            {mode === "add" ? "Add Category" : "Edit Category"}
          </h2>
        </div>

        <div className="cd-body">
          <div className="cd-form-group">
            <label className="cd-label">
              Category Name <span className="cd-required">*</span>
            </label>
            <input
              type="text"
              className="cd-input"
              value={formData.name}
              onChange={handleNameChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="cd-form-group">
            <label className="cd-label">Slug</label>
            <input
              type="text"
              className="cd-input"
              value={formData.slug || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, slug: e.target.value }))
              }
              disabled={isSubmitting}
            />
          </div>

          <div className="cd-form-group">
            <label className="cd-label">Description</label>
            <textarea
              className="cd-textarea"
              placeholder="Enter category description..."
              value={formData.description || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              disabled={isSubmitting}
            ></textarea>
          </div>

          <div className="cd-form-group">
            <label className="cd-label">Parent Category</label>
            <div className="cd-tree-select" ref={treeRef}>
              <div
                className={`cd-tree-trigger ${isSubmitting ? "disabled" : ""}`}
                onClick={() => !isSubmitting && setIsTreeOpen(!isTreeOpen)}
              >
                <span
                  className={formData.parentId ? "" : "cd-tree-placeholder"}
                >
                  {getCategoryPath(formData.parentId)}
                </span>
                <FilterIcon />
              </div>

              {isTreeOpen && !isSubmitting && (
                <div className="cd-tree-dropdown">
                  <div className="cd-tree-search-box">
                    <SearchIcon />
                    <input
                      type="text"
                      placeholder="Tìm kiếm danh mục..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="cd-tree-header-text">
                    {searchTerm.trim()
                      ? "Kết quả tìm kiếm"
                      : "Select parent category"}
                  </div>

                  <div className="cd-tree-dropdown-list">
                    {!searchTerm.trim() ? (
                      <>
                        <div
                          className={`cd-tree-node cd-root-node ${formData.parentId === null ? "selected" : ""}`}
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              parentId: null,
                            }));
                            setIsTreeOpen(false);
                            setSearchTerm("");
                          }}
                        >
                          <div className="cd-folder-icon cd-mr-8">
                            <FolderIcon />
                          </div>
                          <span className="cd-tree-path">
                            None (Root Category)
                          </span>
                          {formData.parentId === null && (
                            <span className="cd-check-icon">✓</span>
                          )}
                        </div>
                        {renderTreeNodes(categories)}
                      </>
                    ) : filteredSearchNodes.length > 0 ? (
                      filteredSearchNodes.map(({ id, node, path }) => (
                        <div
                          key={id}
                          className={`cd-tree-node ${formData.parentId === id ? "selected" : ""}`}
                          onClick={() => {
                            const forceInactive = node.status === "Inactive";
                            setFormData((prev) => ({
                              ...prev,
                              parentId: id,
                              status: forceInactive ? "Inactive" : prev.status,
                            }));
                            setIsTreeOpen(false);
                            setSearchTerm("");
                          }}
                        >
                          <div className="cd-folder-icon cd-mr-8">
                            <FolderIcon />
                          </div>
                          <span className="cd-tree-path">{path}</span>
                          {formData.parentId === id && (
                            <span className="cd-check-icon">✓</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="cd-empty-search">
                        Không tìm thấy danh mục nào
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="cd-form-group">
            <label className="cd-label">Category Status</label>
            <div className="cd-status-row">
              <button
                type="button"
                className={`cd-toggle-switch ${formData.status === "Active" ? "on" : ""} ${isParentInactive || isSubmitting ? "disabled-toggle" : ""}`}
                disabled={isSubmitting || isParentInactive}
                onClick={() => {
                  if (isParentInactive || isSubmitting) return;
                  setFormData((prev) => ({
                    ...prev,
                    status: prev.status === "Active" ? "Inactive" : "Active",
                  }));
                }}
              ></button>
              <span className="cd-status-text">{formData.status}</span>
              {isParentInactive && (
                <span className="cd-status-warning">(Parent is Inactive)</span>
              )}
            </div>
          </div>
        </div>

        <div className="cd-footer">
          <button
            type="button"
            className="cd-btn-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="cd-btn-submit"
            disabled={!isFormValid || isSubmitting}
            onClick={handleSave}
          >
            {isSubmitting
              ? "Saving..."
              : mode === "add"
                ? "Create Category"
                : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}
