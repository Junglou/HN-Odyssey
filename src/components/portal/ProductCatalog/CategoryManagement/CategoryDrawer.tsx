import { useState, useRef, useMemo } from "react";
import "./CategoryDrawer.css";
import {
  BackArrowIcon,
  FilterIcon,
  FolderIcon,
} from "../../../../assets/icons/CategoryIcons";
import { ChevronDownIcon } from "../../../../assets/icons/HeaderIcons";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import type {
  CategoryNode,
  CategoryStatus,
} from "../../../../utils/portal/ProductCatalog/CategoryManagement/categoryTree.utils";

// props
export interface CategoryFormData {
  name: string;
  parentId: string | null;
  status: CategoryStatus;
}

interface CategoryDrawerProps {
  isOpen: boolean;
  mode: "add" | "edit";
  initialData?: CategoryFormData;
  categories: CategoryNode[];
  editingId?: string;
  onClose: () => void;
  onSave: (data: CategoryFormData) => void;
}

export default function CategoryDrawer({
  isOpen,
  mode,
  initialData,
  categories,
  editingId,
  onClose,
  onSave,
}: CategoryDrawerProps) {
  const [formData, setFormData] = useState<CategoryFormData>(
    initialData && mode === "edit"
      ? initialData
      : { name: "", parentId: null, status: "Active" },
  );

  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const treeRef = useRef<HTMLDivElement>(null);
  const [expandedDropdownIds, setExpandedDropdownIds] = useState<Set<string>>(
    new Set(categories.map((c) => c.id)),
  );

  // hook đóng khi click ra ngoài
  useClickOutside(treeRef, () => setIsTreeOpen(false));

  // tạo map dữ liệu giúp tối ưu tìm kiếm
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

  // logic ẩn danh mục con của danh mục đang được edit
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

  // hàm hỗ trợ lấy ra đường dẫn đầy đủ của danh mục cha
  const getCategoryPath = (id: string | null): string => {
    if (!id) return "None (Root Category)";

    let path = "";
    let currentId: string | null = id;

    // duyệt ngược lên gốc để lấy chuỗi đường dẫn
    while (currentId) {
      const node = categoryMap.get(currentId);
      if (!node) break;
      path = path ? `${node.name} > ${path}` : node.name;
      currentId = parentMap.get(currentId) || null;
    }

    return path;
  };
  if (!isOpen) return null;

  // lấy data danh mục cha
  const selectedParentNode = formData.parentId
    ? (categoryMap.get(formData.parentId) ?? null)
    : null;

  // kiểm tra trạng thái danh mục cha
  const isParentInactive = selectedParentNode?.status === "Inactive";

  // hàm đệ quy cây danh mục
  const renderTreeNodes = (
    nodes: CategoryNode[],
    level: number = 0,
    parentPath: string = "",
  ) => {
    return nodes.map((node) => {
      // ẩn danh mục đang được chỉnh sửa
      if (hiddenNodeIds.has(node.id)) return null;

      const hasChildren = !!node.children && node.children.length > 0;
      const isSelected = formData.parentId === node.id;
      const currentPath = parentPath
        ? `${parentPath} > ${node.name}`
        : node.name;

      // kiểm tra trạng thái danh mục
      const isExpanded = expandedDropdownIds.has(node.id);

      return (
        <div key={node.id}>
          <div
            className={`cd-tree-node ${isSelected ? "selected" : ""}`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={(e) => {
              e.stopPropagation();
              const clickedNode = categoryMap.get(node.id);

              // nếu danh mục cha inactive con inactive
              const forceInactive = clickedNode?.status === "Inactive";
              setFormData((prev) => ({
                ...prev,
                parentId: node.id,
                status: forceInactive ? "Inactive" : prev.status,
              }));
              setIsTreeOpen(false);
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
                  <span style={{ width: 16 }}></span>
                )}
              </div>
              {/* sử dụng component icon folder dạng outline thay cho emoji */}
              <div className="cd-folder-icon">
                <FolderIcon />
              </div>
            </div>

            <span className="cd-tree-path">{currentPath}</span>

            {/* hiển thị dấu tích nếu danh mục này đang được chọn */}
            {isSelected && <span className="cd-check-icon">✓</span>}
          </div>
          {hasChildren &&
            isExpanded &&
            renderTreeNodes(node.children ?? [], level + 1, currentPath)}
        </div>
      );
    });
  };

  // logic nút submit
  const handleSave = () => {
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  // kiểm tra điều kiện để tắt hoặc kích hoạt nút submit
  const isFormValid = formData.name.trim().length > 0;

  return (
    <>
      {/* tạo overlay và phần nội dung chính của ngăn kéo */}
      <div className="cd-overlay" onClick={onClose}></div>
      <div className="cd-drawer">
        <div className="cd-header">
          <button type="button" className="cd-back-btn" onClick={onClose}>
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
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div className="cd-form-group">
            <label className="cd-label">Parent Category</label>
            <div className="cd-tree-select" ref={treeRef}>
              <div
                className="cd-tree-trigger"
                onClick={() => setIsTreeOpen(!isTreeOpen)}
              >
                <span
                  className={formData.parentId ? "" : "cd-tree-placeholder"}
                >
                  {/* gọi hàm để hiển thị chuỗi đường dẫn đầy đủ */}
                  {getCategoryPath(formData.parentId)}
                </span>
                <FilterIcon />
              </div>

              {isTreeOpen && (
                <div className="cd-tree-dropdown">
                  <div className="cd-tree-header-text">
                    Select parent category
                  </div>
                  <div
                    className={`cd-tree-node ${formData.parentId === null ? "selected" : ""}`}
                    /* bỏ thụt lề cho mục không chọn danh mục cha để thẳng hàng với các mục cấp gốc khác */
                    style={{ paddingLeft: "8px" }}
                    onClick={() => {
                      setFormData({ ...formData, parentId: null });
                      setIsTreeOpen(false);
                    }}
                  >
                    {/* loại bỏ thẻ bao bọc dư thừa và chỉ giữ lại icon folder để tránh bị đẩy lùi vào trong */}
                    <div
                      className="cd-folder-icon"
                      style={{ marginRight: "8px" }}
                    >
                      <FolderIcon />
                    </div>

                    <span className="cd-tree-path">None (Root Category)</span>

                    {formData.parentId === null && (
                      <span className="cd-check-icon">✓</span>
                    )}
                  </div>
                  {renderTreeNodes(categories)}
                </div>
              )}
            </div>
          </div>

          <div className="cd-form-group">
            <label className="cd-label">Category Status</label>
            <div className="cd-status-row">
              <button
                type="button"
                className={`cd-toggle-switch ${formData.status === "Active" ? "on" : ""}`}
                style={{
                  opacity: isParentInactive ? 0.5 : 1,
                  cursor: isParentInactive ? "not-allowed" : "pointer",
                }}
                onClick={() => {
                  if (isParentInactive) return;
                  setFormData((prev) => ({
                    ...prev,
                    status: prev.status === "Active" ? "Inactive" : "Active",
                  }));
                }}
              ></button>
              <span className="cd-status-text">{formData.status}</span>
              {isParentInactive && (
                <span style={{ fontSize: "0.8rem", color: "#ef4444" }}>
                  (Parent is Inactive)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="cd-footer">
          <button type="button" className="cd-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`cd-btn-submit ${isFormValid ? "active" : ""}`}
            disabled={!isFormValid}
            onClick={handleSave}
          >
            {mode === "add" ? "Create Category" : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}
