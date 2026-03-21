import { useState, useRef, useCallback } from "react";
import "./CategoryManagement.css";
import CategoryTableRow, { type FlatCategoryNode } from "./CategoryTableRow";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";

interface CategoryManagementProps {
  data: FlatCategoryNode[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddClick: () => void;
  onToggleExpand: (id: string) => void;
  onEditClick: (id: string) => void;
  onDeleteClick: (id: string) => void;
  onMoveCategory: (draggedId: string, targetId: string) => void;
}

export default function CategoryManagement({
  data,
  searchQuery,
  onSearchChange,
  onAddClick,
  onToggleExpand,
  onEditClick,
  onDeleteClick,
  onMoveCategory,
}: CategoryManagementProps) {
  // Quản lý ID của danh mục đang mở menu
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Gọi hook
  useClickOutside(tableRef, () => setOpenDropdownId(null));

  const handleToggleDropdown = useCallback((id: string) => {
    setOpenDropdownId((prev) => (prev === id ? null : id));
  }, []);

  const handleEdit = useCallback(
    (id: string) => {
      onEditClick(id);
      setOpenDropdownId(null);
    },
    [onEditClick],
  );

  const handleDelete = useCallback(
    (id: string) => {
      onDeleteClick(id);
      setOpenDropdownId(null);
    },
    [onDeleteClick],
  );

  return (
    <div className="cm-container">
      <div className="cm-header">
        <div>
          <h1 className="cm-title">Category Management</h1>
          <p className="cm-breadcrumb">Product Catalog / Category Management</p>
        </div>
        <button type="button" className="cm-btn-add" onClick={onAddClick}>
          Add New Category
        </button>
      </div>

      <div className="cm-card">
        <input
          type="text"
          className="cm-search-input"
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        <div className="cm-table-wrapper" ref={tableRef}>
          <table className="cm-table">
            <thead>
              <tr>
                <th style={{ width: "60%" }}>Category Name</th>
                <th style={{ width: "20%" }}>Status</th>
                <th style={{ width: "20%", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((cat) => (
                  <CategoryTableRow
                    key={cat.id}
                    node={cat}
                    isDropdownOpen={openDropdownId === cat.id}
                    onToggleDropdown={handleToggleDropdown}
                    onToggleExpand={onToggleExpand}
                    onEditClick={handleEdit}
                    onDeleteClick={handleDelete}
                    onMoveCategory={onMoveCategory}
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "#6b7280",
                    }}
                  >
                    No categories found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
