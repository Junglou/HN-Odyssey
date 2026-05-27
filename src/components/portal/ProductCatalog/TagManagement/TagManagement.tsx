import { useState, useEffect } from "react";
import "./TagManagement.css";

import { DotsIcon } from "../../../../assets/icons/UserManagementIcons";
import { CleanTrashIcon } from "../../../../assets/icons/VariantManagementIcons";
import { EditPenIcon } from "../../../../assets/icons/ProductManagementIcons";

// import type từ hook
import type { Tag } from "../../../../hooks/portal/ProductCatalog/TagManagement/useTagManagement";

// định nghĩa props nhận từ page
interface TagManagementProps {
  data: Tag[];
  search: string;
  actions: {
    changeSearch: (val: string) => void;
    openDrawer: (mode: "add" | "edit", tag?: Tag) => void;
    deleteSingle: (id: string) => void;
  };
}

export default function TagManagement({
  data,
  search,
  actions,
}: TagManagementProps) {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

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
                <th style={{ width: "20%" }}>Usage Count</th>
                <th style={{ width: "15%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((tag) => (
                  <tr key={tag._id}>
                    <td>
                      <span
                        className="tm-tag-name"
                        style={{
                          backgroundColor: tag.bg_color,
                          color: tag.text_color,
                          padding: "4px 8px",
                          borderRadius: "4px",
                          display: "inline-block",
                          fontWeight: 500,
                        }}
                      >
                        {tag.name}
                      </span>
                    </td>
                    <td className="tm-td-desc">
                      {tag.description ? (
                        tag.description
                      ) : (
                        <span className="tm-empty-text">Empty</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: "#4B5563" }}>
                        {tag.usage_count}
                      </span>
                    </td>
                    <td>
                      <div className="tm-action-group">
                        <button
                          type="button"
                          className="tm-icon-btn"
                          title="Delete Tag"
                          onClick={(e) => {
                            actions.deleteSingle(tag._id);
                            e.currentTarget.blur();
                          }}
                        >
                          <CleanTrashIcon />
                        </button>

                        <div
                          className={`tm-dropdown-wrapper ${openDropdownId === tag._id ? "is-open" : ""}`}
                        >
                          <button
                            type="button"
                            className="tm-icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(
                                openDropdownId === tag._id ? null : tag._id,
                              );
                              e.currentTarget.blur();
                            }}
                          >
                            <DotsIcon fill="#111827" />
                          </button>

                          {openDropdownId === tag._id && (
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
