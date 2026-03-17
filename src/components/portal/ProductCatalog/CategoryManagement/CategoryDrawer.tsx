import { useState, useRef, useMemo } from "react";
import "./CategoryDrawer.css";
import {
  BackArrowIcon,
  FilterIcon,
} from "../../../../assets/icons/CategoryIcons";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import type {
  CategoryNode,
  CategoryStatus,
} from "../../../../utils/portal/ProductCatalog/CategoryManagement/categoryTree.utils";

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
  // Khởi tạo state một lần duy nhất khi component mount.
  // Nhờ có thuộc tính "key" truyền từ component cha, component này sẽ
  // tự động làm mới hoàn toàn mỗi khi ngăn kéo được mở lên.
  const [formData, setFormData] = useState<CategoryFormData>(
    initialData && mode === "edit"
      ? initialData
      : { name: "", parentId: null, status: "Active" },
  );

  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const treeRef = useRef<HTMLDivElement>(null);

  // Tự động đóng danh sách chọn danh mục cha khi nhấp chuột ra ngoài
  useClickOutside(treeRef, () => setIsTreeOpen(false));

  // Biến mảng dữ liệu thành một Map để tối ưu thời gian tìm kiếm phần tử từ O(n) xuống O(1)
  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryNode>();
    const walk = (nodes: CategoryNode[]) => {
      for (const node of nodes) {
        map.set(node.id, node);
        if (node.children) walk(node.children);
      }
    };
    walk(categories);
    return map;
  }, [categories]);

  // Đã xóa hoàn toàn useEffect gây lỗi Cascading Renders ở đây

  if (!isOpen) return null;

  const selectedParentNode = formData.parentId
    ? (categoryMap.get(formData.parentId) ?? null)
    : null;

  // Xác định xem danh mục cha được chọn có đang bị ẩn hay không để khóa trạng thái
  const isParentInactive = selectedParentNode?.status === "Inactive";

  // Hàm đệ quy vẽ cấu trúc cây danh mục bên trong ô chọn thả xuống
  const renderTreeNodes = (nodes: CategoryNode[], level: number = 0) => {
    return nodes.map((node) => {
      // Ẩn danh mục đang được chỉnh sửa để người dùng không chọn nhầm nó làm cha của chính nó
      if (mode === "edit" && editingId === node.id) return null;

      const hasChildren = !!node.children && node.children.length > 0;
      const isSelected = formData.parentId === node.id;

      return (
        <div key={node.id}>
          <div
            className={`cd-tree-node ${isSelected ? "selected" : ""}`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={(e) => {
              e.stopPropagation();
              const clickedNode = categoryMap.get(node.id);

              // Nếu người dùng chọn danh mục cha đang bị ẩn, ép trạng thái của danh mục hiện tại thành ẩn theo
              const forceInactive = clickedNode?.status === "Inactive";
              setFormData((prev) => ({
                ...prev,
                parentId: node.id,
                status: forceInactive ? "Inactive" : prev.status,
              }));
              setIsTreeOpen(false);
            }}
          >
            <div className="cd-tree-toggle">{hasChildren ? "▾" : ""}</div>
            <span>{node.name}</span>
          </div>
          {hasChildren && renderTreeNodes(node.children ?? [], level + 1)}
        </div>
      );
    });
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  const isFormValid = formData.name.trim().length > 0;

  return (
    <>
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
                  {selectedParentNode
                    ? selectedParentNode.name
                    : "None (Root Category)"}
                </span>
                <FilterIcon />
              </div>

              {isTreeOpen && (
                <div className="cd-tree-dropdown">
                  <div
                    className={`cd-tree-node ${formData.parentId === null ? "selected" : ""}`}
                    onClick={() => {
                      setFormData({ ...formData, parentId: null });
                      setIsTreeOpen(false);
                    }}
                  >
                    <div className="cd-tree-toggle"></div>
                    <span>None (Root Category)</span>
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
