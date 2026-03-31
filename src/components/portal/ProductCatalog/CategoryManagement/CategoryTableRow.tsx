import { useState, memo } from "react";
import { ChevronDownIcon } from "../../../../assets/icons/HeaderIcons";
import { DotsIcon } from "../../../../assets/icons/UserManagementIcons";
import { DragHandleIcon } from "../../../../assets/icons/CategoryIcons";

// props
export type CategoryStatus = "Active" | "Inactive";

export interface FlatCategoryNode {
  id: string;
  name: string;
  status: CategoryStatus;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

interface CategoryTableRowProps {
  node: FlatCategoryNode;
  isDropdownOpen: boolean;
  onToggleDropdown: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onEditClick: (id: string) => void;
  onDeleteClick: (id: string) => void;
  onMoveCategory: (draggedId: string, targetId: string) => void;
}

const CategoryTableRow = memo(function CategoryTableRow({
  node,
  isDropdownOpen,
  onToggleDropdown,
  onToggleExpand,
  onEditClick,
  onDeleteClick,
  onMoveCategory,
}: CategoryTableRowProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  // hàm sự kiện kéo thả
  const handleDragStart = (e: React.DragEvent<HTMLSpanElement>) => {
    e.dataTransfer.setData("text/plain", node.id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault(); // gọi preventDefault để trình duyệt cho phép thả
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const draggedId = e.dataTransfer.getData("text/plain");
    // logic chỉ thực hiện kéo thả nếu id kéo khác với id của dòng thả vào
    if (draggedId && draggedId !== node.id) {
      onMoveCategory(draggedId, node.id);
    }
  };

  // hàm thu mở danh mục
  const handleExpandClick = () => {
    onToggleExpand(node.id);
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // ngăn click lan ra ngoài làm đóng menu
    onToggleDropdown(node.id);
  };

  const handleEdit = () => {
    onEditClick(node.id);
  };

  const handleDelete = () => {
    onDeleteClick(node.id);
  };

  // class css
  const rowClassName = `cm-row ${isDragOver ? "drag-over" : ""}`;
  const toggleClassName = `cm-toggle-btn ${node.isExpanded ? "expanded" : "collapsed"}`;
  const actionBtnClassName = `cm-action-btn ${isDropdownOpen ? "active" : ""}`;

  return (
    <tr
      className={rowClassName}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <td>
        <div
          className="cm-td-name-wrapper"
          style={{ "--depth": node.depth } as React.CSSProperties}
        >
          <span
            className="cm-drag-icon"
            draggable
            onDragStart={handleDragStart}
          >
            <DragHandleIcon />
          </span>

          {node.hasChildren ? (
            <button
              type="button"
              className={toggleClassName}
              onClick={handleExpandClick}
            >
              <ChevronDownIcon />
            </button>
          ) : (
            <span className="cm-spacer"></span>
          )}

          <span
            className={`cm-category-name ${node.depth === 0 ? "depth-root" : ""}`}
          >
            {node.name}
          </span>
        </div>
      </td>

      <td>
        <span className={`cm-status-badge status-${node.status}`}>
          <span className="cm-dot"></span>
          {node.status}
        </span>
      </td>

      <td>
        <div className="cm-action-wrapper">
          <button
            type="button"
            className={actionBtnClassName}
            onClick={handleActionClick}
            aria-haspopup="menu"
            aria-expanded={isDropdownOpen}
          >
            <DotsIcon />
          </button>

          {isDropdownOpen && (
            <div
              className="cm-dropdown-menu"
              role="menu"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="cm-dropdown-item"
                role="menuitem"
                onClick={handleEdit}
              >
                Edit Category
              </button>
              <button
                type="button"
                className="cm-dropdown-item cm-item-delete"
                role="menuitem"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
});

export default CategoryTableRow;
