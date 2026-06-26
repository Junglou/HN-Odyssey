import { useState, useRef } from "react";
import "./BlogNewsManagement.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import {
  SearchIcon,
  ChevronDownIcon,
  EditIcon,
  ViewIcon,
} from "../../../../assets/icons/BlogNewsManagementIcons";
import type {
  BlogNewsRecord,
  BlogNewsStatus,
} from "../../../../hooks/portal/Communication/BlogNewsManagement/useBlogNewsManagement";

interface BlogNewsManagementProps {
  data: BlogNewsRecord[];
  search: string;
  statusFilter: BlogNewsStatus | "All";
  selectedIds: Set<string>;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalFiltered: number;
    startIndex: number;
  };
  actions: {
    changeSearch: (val: string) => void;
    changeStatusFilter: (status: BlogNewsStatus | "All") => void;
    clearFilters: () => void;
    changePage: (page: number) => void;
    changeLimit: (limit: number) => void;
    toggleSelection: (id: string) => void;
    toggleSelectAll: (isAll: boolean) => void;
    openAddDrawer: () => void;
    openEditDrawer: (record: BlogNewsRecord) => void;
    openViewDrawer: (record: BlogNewsRecord) => void;
    openDeleteModal: (id?: string) => void;
  };
  bulkActions: {
    bulkPublish: () => void;
    bulkHide: () => void;
    bulkDelete: () => void;
  };
}

export default function BlogNewsManagement({
  data,
  search,
  statusFilter,
  selectedIds,
  pagination,
  actions,
  bulkActions,
}: BlogNewsManagementProps) {
  // quản lý trạng thái đóng mở cho bộ lọc và phân trang
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [hasStatusOpened, setHasStatusOpened] = useState(false);
  const [isLimitDropdownOpen, setIsLimitDropdownOpen] = useState(false);
  const [hasLimitOpened, setHasLimitOpened] = useState(false);

  const statusRef = useRef<HTMLDivElement>(null);
  const limitRef = useRef<HTMLDivElement>(null);

  // theo dõi hành động click chuột ra ngoài để đóng các dropdown
  useClickOutside(statusRef, () => setIsStatusOpen(false));
  useClickOutside(limitRef, () => setIsLimitDropdownOpen(false));

  const isAllSelected = data.length > 0 && selectedIds.size === data.length;

  return (
    <div className="ban-container">
      <div className="ban-header">
        <div>
          <h1 className="ban-title">Blog&News Management</h1>
          <p className="ban-breadcrumb">Communication / Blog&News Management</p>
        </div>
        <button className="ban-btn-add" onClick={actions.openAddDrawer}>
          + Create Article
        </button>
      </div>

      <div className="ban-card">
        <div className="ban-toolbar">
          <div className="ban-filters-row">
            <div className="ban-search-wrapper">
              <SearchIcon />
              <input
                type="text"
                className="ban-filter-input"
                placeholder="Search by Title"
                value={search}
                onChange={(e) => actions.changeSearch(e.target.value)}
              />
            </div>

            <div className="ban-custom-dropdown" ref={statusRef}>
              <div
                className={`ban-dropdown-trigger ${isStatusOpen ? "active" : ""}`}
                onClick={() => {
                  setIsStatusOpen(!isStatusOpen);
                  if (!hasStatusOpened) setHasStatusOpened(true);
                }}
              >
                <span>{statusFilter === "All" ? "Status" : statusFilter}</span>
                <ChevronDownIcon
                  className={`ban-dropdown-arrow ${isStatusOpen ? "open" : ""}`}
                />
              </div>

              <div
                className={`ban-dropdown-options ${isStatusOpen ? "open" : hasStatusOpened ? "closed" : ""}`}
              >
                {(["All", "Published", "Draft", "Hidden"] as const).map(
                  (opt) => (
                    <div
                      key={opt}
                      className={`ban-dropdown-option ${statusFilter === opt ? "active" : ""}`}
                      onClick={() => {
                        actions.changeStatusFilter(opt);
                        setIsStatusOpen(false);
                      }}
                    >
                      {opt}
                    </div>
                  ),
                )}
              </div>
            </div>

            <button
              type="button"
              className="ban-btn-clear"
              onClick={actions.clearFilters}
            >
              Clear Filter
            </button>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="ban-bulk-actions">
            <span className="ban-bulk-text">
              {selectedIds.size} items selected
            </span>
            <button
              className="ban-btn-bulk publish"
              onClick={bulkActions.bulkPublish}
            >
              Publish
            </button>
            <button
              className="ban-btn-bulk hide"
              onClick={bulkActions.bulkHide}
            >
              Hide
            </button>
            <button
              className="ban-btn-bulk delete"
              onClick={bulkActions.bulkDelete}
            >
              Delete
            </button>
          </div>
        )}

        <div className="ban-table-container">
          <table className="ban-table">
            <thead>
              <tr>
                <th style={{ width: "4%" }}>
                  <input
                    type="checkbox"
                    className="ban-checkbox"
                    checked={isAllSelected}
                    onChange={(e) => actions.toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th style={{ width: "35%" }}>Article</th>
                <th style={{ width: "15%" }}>Category</th>
                <th style={{ width: "12%" }}>Author</th>
                <th style={{ width: "12%" }}>Publish Date</th>
                <th style={{ width: "10%" }}>Status</th>
                <th style={{ width: "12%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="ban-checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => actions.toggleSelection(row.id)}
                      />
                    </td>
                    <td>
                      <div className="ban-article-info">
                        <img
                          src={row.featuredImage}
                          alt="img"
                          className="ban-article-img"
                        />
                        <div className="ban-article-text">
                          <span className="ban-article-title" title={row.title}>
                            {row.title}
                          </span>
                          <span
                            className="ban-article-slug"
                            title={`/${row.slug}`}
                          >
                            /{row.slug}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>{row.category}</td>
                    <td>{row.author}</td>
                    <td>{row.publishDate || "N/A"}</td>
                    <td>
                      <span
                        className={`ban-status-badge ${row.status.toLowerCase()}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <div className="ban-row-actions">
                        {/* chỉ giữ lại các nút có trong thiết kế prototype ban đầu */}
                        <button
                          className="ban-icon-btn"
                          onClick={() => actions.openViewDrawer(row)}
                          title="View Details"
                        >
                          <ViewIcon />
                        </button>
                        <button
                          className="ban-icon-btn"
                          onClick={() => actions.openEditDrawer(row)}
                          title="Edit Article"
                        >
                          <EditIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", padding: "40px" }}
                  >
                    No articles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ban-pagination">
          <span className="ban-pagination-info">
            Showing{" "}
            {pagination.totalFiltered === 0 ? 0 : pagination.startIndex + 1} to{" "}
            {Math.min(
              pagination.startIndex + pagination.limit,
              pagination.totalFiltered,
            )}{" "}
            of {pagination.totalFiltered} articles
          </span>
          <div className="ban-page-numbers">
            <button
              className="ban-page-num"
              disabled={pagination.page === 1}
              onClick={() => actions.changePage(pagination.page - 1)}
            >
              &lt;
            </button>

            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (num) => (
                <button
                  key={num}
                  className={`ban-page-num ${pagination.page === num ? "active" : ""}`}
                  onClick={() => actions.changePage(num)}
                >
                  {num}
                </button>
              ),
            )}

            <button
              className="ban-page-num"
              disabled={
                pagination.page === pagination.totalPages ||
                pagination.totalPages === 0
              }
              onClick={() => actions.changePage(pagination.page + 1)}
            >
              &gt;
            </button>

            <div className="ban-limit-dropdown" ref={limitRef}>
              <div
                className={`ban-limit-trigger ${isLimitDropdownOpen ? "active" : ""}`}
                onClick={() => {
                  setIsLimitDropdownOpen(!isLimitDropdownOpen);
                  if (!hasLimitOpened) setHasLimitOpened(true); // Sửa ở đây
                }}
              >
                <span>{pagination.limit} / page</span>
                <ChevronDownIcon
                  className={`ban-dropdown-arrow ${isLimitDropdownOpen ? "open" : ""}`}
                />
              </div>

              <div
                className={`ban-limit-options ${isLimitDropdownOpen ? "open" : hasLimitOpened ? "closed" : ""}`}
              >
                {[10, 20, 50].map((val) => (
                  <div
                    key={val}
                    className={`ban-limit-option ${pagination.limit === val ? "active" : ""}`}
                    onClick={() => {
                      actions.changeLimit(val);
                      setIsLimitDropdownOpen(false);
                    }}
                  >
                    {val} / page
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
