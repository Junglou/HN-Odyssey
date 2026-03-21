import { useState, useEffect } from "react";
import "./TagManagement.css";

import {
  DotsIcon,
  TrashIcon,
} from "../../../../assets/icons/UserManagementIcons";
import { EditPenIcon } from "../../../../assets/icons/ProductManagementIcons";

// import type từ hook
import type {
  Tag,
  TagStatus,
} from "../../../../hooks/portal/ProductCatalog/TagManagement/useTagManagement";

// định nghĩa props nhận từ page
interface TagManagementProps {
  data: Tag[];
  search: string;
  actions: {
    changeSearch: (val: string) => void;
    openDrawer: (mode: "add" | "edit", tag?: Tag) => void;
    toggleStatus: (id: number, currentStatus: TagStatus) => void;
    deleteSingle: (id: number) => void;
  };
}

export default function TagManagement({
  data,
  search,
  actions,
}: TagManagementProps) {
  // state quản lý menu 3 chấm
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  // tắt menu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = () => {
      if (openDropdownId !== null) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openDropdownId]);

  return (
    <div className="tm-container">
      <div className="tm-header">
        <div>
          <h1 className="tm-title">Tag Management</h1>
          <p className="tm-breadcrumb">Product Catalog / Tag Management</p>
        </div>
        <button
          type="button"
          className="tm-btn-add"
          onClick={(e) => {
            actions.openDrawer("add");
            e.currentTarget.blur();
          }}
        >
          Add New Tag
        </button>
      </div>

      <div className="tm-card">
        <div className="tm-filters-row">
          <input
            type="text"
            className="tm-search-input"
            placeholder="Search by name"
            value={search}
            onChange={(e) => actions.changeSearch(e.target.value)}
          />
        </div>

        <div className="tm-table-wrapper">
          <table className="tm-table">
            <thead>
              <tr>
                <th style={{ width: "25%" }}>Tag Name</th>
                <th style={{ width: "40%" }}>Description</th>
                <th style={{ width: "20%" }}>Status</th>
                <th style={{ width: "15%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((tag) => (
                  <tr key={tag.id}>
                    <td className="tm-td-name">{tag.name}</td>
                    <td className="tm-td-desc">
                      {tag.description ? (
                        tag.description
                      ) : (
                        <span className="tm-empty-text">Empty</span>
                      )}
                    </td>
                    <td>
                      <span className={`tm-status-badge status-${tag.status}`}>
                        <span className="tm-dot"></span> {tag.status}
                      </span>
                    </td>
                    <td>
                      <div className="tm-action-group">
                        <button
                          type="button"
                          className="tm-icon-btn"
                          title="Delete Tag"
                          onClick={(e) => {
                            actions.deleteSingle(tag.id);
                            e.currentTarget.blur();
                          }}
                        >
                          <TrashIcon fill="#111827" />
                        </button>

                        <div
                          className={`tm-dropdown-wrapper ${openDropdownId === tag.id ? "is-open" : ""}`}
                        >
                          <button
                            type="button"
                            className="tm-icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(
                                openDropdownId === tag.id ? null : tag.id,
                              );
                              e.currentTarget.blur();
                            }}
                          >
                            <DotsIcon fill="#111827" />
                          </button>

                          {openDropdownId === tag.id && (
                            <div
                              className="tm-dropdown-menu"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="tm-dropdown-item"
                                onClick={(e) => {
                                  actions.openDrawer("edit", tag);
                                  setOpenDropdownId(null);
                                  e.currentTarget.blur();
                                }}
                              >
                                <EditPenIcon /> Edit
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="tm-td-empty">
                    No tags found.
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
