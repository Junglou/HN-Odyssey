import { useState, useRef } from "react";
import "./StaticPageManagement.css";
// sử dụng hook xử lý click ra ngoài để đóng dropdown
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import {
  SearchIcon,
  ChevronDownIcon,
  EditIcon,
  ViewIcon,
} from "../../../../assets/icons/StaticPageManagementIcons";
import type {
  StaticPageRecord,
  PageStatus,
  PageType,
} from "../../../../hooks/portal/Communication/StaticPageManagement/useStaticPageManagement";

// định nghĩa props nhận từ page
interface StaticPageManagementProps {
  data: StaticPageRecord[];
  search: string;
  statusFilter: PageStatus | "All";
  typeFilter: PageType | "All";
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
    changeStatusFilter: (status: PageStatus | "All") => void;
    changeTypeFilter: (type: PageType | "All") => void;
    clearFilters: () => void;
    toggleSelection: (id: string) => void;
    toggleSelectAll: (isSelectAll: boolean) => void;
    openAddModal: () => void;
    openEditModal: (record: StaticPageRecord) => void;
    openViewModal: (record: StaticPageRecord) => void;
    changePage: (page: number) => void;
    changeLimit: (limit: number) => void;
    toggleHiddenStatus: (id: string) => void;
  };
  bulkActions: {
    bulkActivate: () => void;
    bulkDelete: () => void;
  };
}

export default function StaticPageManagement({
  data,
  search,
  statusFilter,
  typeFilter,
  selectedIds,
  pagination,
  actions,
  bulkActions,
}: StaticPageManagementProps) {
  // state quản lý đóng mở các menu dropdown
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isLimitDropdownOpen, setIsLimitDropdownOpen] = useState(false);

  const statusRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const limitRef = useRef<HTMLDivElement>(null);

  useClickOutside(statusRef, () => setIsStatusOpen(false));
  useClickOutside(typeRef, () => setIsTypeOpen(false));
  useClickOutside(limitRef, () => setIsLimitDropdownOpen(false));

  const isAllSelected =
    data.length > 0 && data.every((r) => selectedIds.has(r.id));
  const isPartiallySelected =
    data.some((r) => selectedIds.has(r.id)) && !isAllSelected;

  // hàm render màu badge theo từng trạng thái cụ thể
  const renderStatusBadge = (status: PageStatus) => {
    switch (status) {
      case "Published":
        return <span className="sp-badge sp-badge-published">Published</span>;
      case "Draft":
        return <span className="sp-badge sp-badge-draft">Draft</span>;
      case "Hidden":
        return <span className="sp-badge sp-badge-hidden">Hidden</span>;
      default:
        return null;
    }
  };

  return (
    <div className="sp-container">
      <div className="sp-header">
        <div>
          <h1 className="sp-title">Static Page Management</h1>
          <p className="sp-breadcrumb">
            Communication Management / Static Page Management
          </p>
        </div>
        <button
          type="button"
          className="sp-btn-add"
          onClick={actions.openAddModal}
        >
          Create Static Page
        </button>
      </div>

      <div className="sp-filters-card">
        <div className="sp-toolbar">
          <div className="sp-filters-row">
            <div className="sp-search-wrapper">
              <SearchIcon />
              <input
                type="text"
                className="sp-filter-input with-icon"
                placeholder="Search by Page title"
                value={search}
                onChange={(e) => actions.changeSearch(e.target.value)}
              />
            </div>

            <div className="sp-custom-dropdown" ref={statusRef}>
              <div
                className={`sp-dropdown-trigger ${isStatusOpen ? "active" : ""}`}
                onClick={() => setIsStatusOpen(!isStatusOpen)}
              >
                <span>{statusFilter === "All" ? "Status" : statusFilter}</span>
                <ChevronDownIcon />
              </div>
              {isStatusOpen && (
                <div className="sp-dropdown-options">
                  {(["All", "Published", "Draft", "Hidden"] as const).map(
                    (opt) => (
                      <div
                        key={opt}
                        className={`sp-dropdown-option ${statusFilter === opt ? "active" : ""}`}
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
              )}
            </div>

            <div className="sp-custom-dropdown" ref={typeRef}>
              <div
                className={`sp-dropdown-trigger ${isTypeOpen ? "active" : ""}`}
                onClick={() => setIsTypeOpen(!isTypeOpen)}
              >
                <span>{typeFilter === "All" ? "Type" : typeFilter}</span>
                <ChevronDownIcon />
              </div>
              {isTypeOpen && (
                <div className="sp-dropdown-options">
                  {(
                    [
                      "All",
                      "About Us",
                      "Policy",
                      "FAQ",
                      "Contact",
                      "Guide",
                      "Promotion",
                      "Company News",
                    ] as const
                  ).map((opt) => (
                    <div
                      key={opt}
                      className={`sp-dropdown-option ${typeFilter === opt ? "active" : ""}`}
                      onClick={() => {
                        actions.changeTypeFilter(opt);
                        setIsTypeOpen(false);
                      }}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="sp-btn-clear"
              onClick={actions.clearFilters}
            >
              Clear Filter
            </button>

            {/* thao tác nhóm đẩy sang góc phải theo thiết kế */}
            <div className="sp-bulk-actions">
              <button
                type="button"
                className="sp-btn-bulk"
                onClick={bulkActions.bulkActivate}
                disabled={selectedIds.size === 0}
              >
                Bulk Activate
              </button>
              <button
                type="button"
                className="sp-btn-bulk danger"
                onClick={bulkActions.bulkDelete}
                disabled={selectedIds.size === 0}
              >
                Bulk Delete
              </button>
            </div>
          </div>
        </div>

        {/* khu vực bảng dữ liệu */}
        <div className="sp-table-wrapper">
          <table className="sp-table">
            <thead>
              <tr>
                <th style={{ width: "5%" }}>
                  <input
                    type="checkbox"
                    className="sp-checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isPartiallySelected;
                    }}
                    onChange={(e) => actions.toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th style={{ width: "25%" }}>Page Title</th>
                <th style={{ width: "20%" }}>Type</th>
                <th style={{ width: "15%" }}>Status</th>
                <th style={{ width: "20%" }}>Publish Date</th>
                <th style={{ width: "15%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((record) => (
                  <tr
                    key={record.id}
                    className={
                      selectedIds.has(record.id) ? "sp-selected-row" : ""
                    }
                  >
                    <td data-label="Select">
                      <input
                        type="checkbox"
                        className="sp-checkbox"
                        checked={selectedIds.has(record.id)}
                        onChange={() => actions.toggleSelection(record.id)}
                      />
                    </td>
                    <td data-label="Page Title" className="sp-text-strong">
                      {record.title}
                    </td>
                    <td data-label="Type">{record.type}</td>
                    <td data-label="Status">
                      {renderStatusBadge(record.status)}
                    </td>
                    <td data-label="Publish Date">{record.publishDate}</td>
                    <td data-label="Actions">
                      <div className="sp-row-actions">
                        <button
                          type="button"
                          className="sp-icon-btn"
                          title="Edit Page"
                          onClick={() => actions.openEditModal(record)}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="sp-icon-btn"
                          title="View Details"
                          onClick={() => actions.openViewModal(record)}
                        >
                          <ViewIcon />
                        </button>
                        <div className="sp-toggle-cell">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={record.status === "Hidden"}
                            className={`sp-table-toggle ${record.status === "Hidden" ? "on" : ""}`}
                            onClick={() =>
                              actions.toggleHiddenStatus(record.id)
                            }
                            title={
                              record.status === "Hidden"
                                ? "Hiện trang"
                                : "Ẩn trang"
                            }
                          ></button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="sp-empty-state">
                    No static pages found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* khu vực phân trang */}
        <div className="sp-pagination">
          <span className="sp-pagination-info">
            Showing{" "}
            {pagination.totalFiltered === 0 ? 0 : pagination.startIndex + 1} to{" "}
            {Math.min(
              pagination.startIndex + pagination.limit,
              pagination.totalFiltered,
            )}{" "}
            of {pagination.totalFiltered}
          </span>
          <div className="sp-page-numbers">
            <button
              className="sp-page-num"
              disabled={pagination.page === 1}
              onClick={() => actions.changePage(pagination.page - 1)}
            >
              &lt;
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (num) => (
                <button
                  key={num}
                  className={`sp-page-num ${pagination.page === num ? "active" : ""}`}
                  onClick={() => actions.changePage(num)}
                >
                  {num}
                </button>
              ),
            )}
            <button
              className="sp-page-num"
              disabled={
                pagination.page === pagination.totalPages ||
                pagination.totalPages === 0
              }
              onClick={() => actions.changePage(pagination.page + 1)}
            >
              &gt;
            </button>

            <div className="sp-limit-dropdown" ref={limitRef}>
              <div
                className={`sp-limit-trigger ${isLimitDropdownOpen ? "active" : ""}`}
                onClick={() => setIsLimitDropdownOpen(!isLimitDropdownOpen)}
              >
                <span>{pagination.limit} / page</span>
                <div
                  className={`sp-limit-icon ${isLimitDropdownOpen ? "open" : ""}`}
                >
                  <ChevronDownIcon />
                </div>
              </div>
              {isLimitDropdownOpen && (
                <div className="sp-limit-options">
                  {[10, 20, 50].map((val) => (
                    <div
                      key={val}
                      className={`sp-limit-option ${pagination.limit === val ? "active" : ""}`}
                      onClick={() => {
                        actions.changeLimit(val);
                        setIsLimitDropdownOpen(false);
                      }}
                    >
                      {val} / page
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
