import { useState, useRef } from "react";
import "./ReviewAndRatingManagement.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import {
  StarIcon,
  SearchIcon,
  ChevronDownSmallIcon,
  EyeIcon,
  EditIcon,
  LockIcon,
  UnlockIcon,
  HeartIcon,
} from "../../../../assets/icons/ReviewAndRatingManagementIcons";
import type {
  ReviewRecord,
  ReviewStatus,
  DrawerMode,
} from "../../../../hooks/portal/MarketingSuite/ReviewAndRatingManagement/useReviewAndRatingManagement";

// Prop
interface ReviewAndRatingManagementProps {
  data: ReviewRecord[];
  search: string;
  statusFilter: ReviewStatus | "All" | "hidden";
  ratingFilter: string;
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
    changeStatusFilter: (status: ReviewStatus | "All" | "hidden") => void;
    changeRatingFilter: (rating: string) => void;
    clearFilters: () => void;
    toggleSelection: (id: string) => void;
    toggleSelectAll: (isSelectAll: boolean) => void;
    changePage: (page: number) => void;
    changeLimit: (limit: number) => void;
    openDrawer: (record: ReviewRecord, mode: DrawerMode) => void;
    toggleHideStatus: (id: string) => void;
  };
  bulkActions: {
    bulkHide: () => void;
    bulkUnhide: () => void;
    bulkDelete: () => void;
  };
}

export default function ReviewAndRatingManagement({
  data,
  search,
  statusFilter,
  ratingFilter,
  selectedIds,
  pagination,
  actions,
  bulkActions,
}: ReviewAndRatingManagementProps) {
  // State quản lý đóng mở dropdown
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [isLimitDropdownOpen, setIsLimitDropdownOpen] = useState(false);

  // Ref xử lý click outside
  const statusRef = useRef<HTMLDivElement>(null);
  const ratingRef = useRef<HTMLDivElement>(null);
  const limitRef = useRef<HTMLDivElement>(null);

  useClickOutside(statusRef, () => setIsStatusOpen(false));
  useClickOutside(ratingRef, () => setIsRatingOpen(false));
  useClickOutside(limitRef, () => setIsLimitDropdownOpen(false));

  // Trạng thái checkbox tổng
  const isAllSelected =
    data.length > 0 && data.every((r) => selectedIds.has(r.id));
  const isPartiallySelected =
    data.some((r) => selectedIds.has(r.id)) && !isAllSelected;

  // Render đánh giá sao
  const renderStars = (rating: number) => {
    return (
      <div className="rarm-star-container">
        {Array.from({ length: 5 }).map((_, idx) => (
          <StarIcon
            key={idx}
            className={idx < rating ? "rarm-star-active" : "rarm-star-inactive"}
          />
        ))}
      </div>
    );
  };

  // Render badge trạng thái
  const renderStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case "Replied":
        return (
          <span className="rarm-badge rarm-badge-replied">
            <span className="rarm-dot-green"></span> Replied
          </span>
        );
      case "Hidden":
        return (
          <span className="rarm-badge rarm-badge-hidden">
            <span className="rarm-dot-yellow"></span> Hidden
          </span>
        );
      case "New":
        return (
          <span className="rarm-badge rarm-badge-new">
            <span className="rarm-dot-grey"></span> New
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rarm-container">
      {/* Header và breadcrumb */}
      <div className="rarm-header">
        <h1 className="rarm-title">Review & Rating Management</h1>
        <p className="rarm-breadcrumb">
          Marketing Suite / Review & Rating Management
        </p>
      </div>

      <div className="rarm-filters-card">
        {/* Bộ lọc và thanh công cụ */}
        <div className="rarm-toolbar">
          <div className="rarm-filters-row">
            <div className="rarm-search-wrapper">
              <SearchIcon className="rarm-search-icon" />
              <input
                type="text"
                className="rarm-filter-input"
                placeholder="Search by product or customer"
                value={search}
                onChange={(e) => actions.changeSearch(e.target.value)}
              />
            </div>

            {/* Dropdown trạng thái */}
            <div className="rarm-custom-dropdown" ref={statusRef}>
              <div
                className={`rarm-dropdown-trigger ${isStatusOpen ? "active" : ""}`}
                onClick={() => setIsStatusOpen(!isStatusOpen)}
              >
                <span>
                  Status: {statusFilter === "hidden" ? "Hidden" : statusFilter}
                </span>
                <ChevronDownSmallIcon
                  className={`rarm-dropdown-arrow ${isStatusOpen ? "open" : ""}`}
                />
              </div>
              {isStatusOpen && (
                <div className="rarm-dropdown-options">
                  {(["All", "Replied", "New", "hidden"] as const).map((opt) => (
                    <div
                      key={opt}
                      className={`rarm-dropdown-option ${statusFilter === opt ? "active" : ""}`}
                      onClick={() => {
                        actions.changeStatusFilter(opt);
                        setIsStatusOpen(false);
                      }}
                    >
                      {opt === "hidden" ? "Hidden" : opt}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dropdown số sao */}
            <div className="rarm-custom-dropdown" ref={ratingRef}>
              <div
                className={`rarm-dropdown-trigger ${isRatingOpen ? "active" : ""}`}
                onClick={() => setIsRatingOpen(!isRatingOpen)}
              >
                <span>
                  Rating:{" "}
                  {ratingFilter === "All" ? "All" : `${ratingFilter} Stars`}
                </span>
                <ChevronDownSmallIcon
                  className={`rarm-dropdown-arrow ${isRatingOpen ? "open" : ""}`}
                />
              </div>
              {isRatingOpen && (
                <div className="rarm-dropdown-options">
                  {["All", "5", "4", "3", "2", "1"].map((opt) => (
                    <div
                      key={opt}
                      className={`rarm-dropdown-option ${ratingFilter === opt ? "active" : ""}`}
                      onClick={() => {
                        actions.changeRatingFilter(opt);
                        setIsRatingOpen(false);
                      }}
                    >
                      {opt === "All" ? "All" : `${opt} Stars`}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="rarm-btn-clear"
              onClick={actions.clearFilters}
            >
              Clear Filter
            </button>
          </div>

          {/* Thao tác hàng loạt */}
          <div className="rarm-bulk-actions">
            <button
              type="button"
              className="rarm-btn-bulk outline"
              onClick={bulkActions.bulkHide}
              disabled={selectedIds.size === 0}
            >
              Bulk Hide
            </button>
            <button
              type="button"
              className="rarm-btn-bulk outline"
              onClick={bulkActions.bulkUnhide}
              disabled={selectedIds.size === 0}
            >
              Bulk Unhide
            </button>
            <button
              type="button"
              className="rarm-btn-bulk danger"
              onClick={bulkActions.bulkDelete}
              disabled={selectedIds.size === 0}
            >
              Bulk Delete
            </button>
          </div>
        </div>

        {/* Bảng dữ liệu */}
        <div className="rarm-table-wrapper">
          <table className="rarm-table">
            <thead>
              <tr>
                <th style={{ width: "4%" }}>
                  <input
                    type="checkbox"
                    className="rarm-checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isPartiallySelected;
                    }}
                    onChange={(e) => actions.toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th style={{ width: "20%" }}>Product Name</th>
                <th style={{ width: "12%" }}>Customer Name</th>
                <th style={{ width: "12%" }}>Rating</th>
                <th style={{ width: "22%" }}>Review Content</th>
                <th style={{ width: "10%" }}>Price</th>
                <th style={{ width: "10%" }}>Status</th>
                <th style={{ width: "10%", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((record) => (
                  <tr
                    key={record.id}
                    className={
                      selectedIds.has(record.id) ? "rarm-selected-row" : ""
                    }
                  >
                    <td data-label="Select">
                      <input
                        type="checkbox"
                        className="rarm-checkbox"
                        checked={selectedIds.has(record.id)}
                        onChange={() => actions.toggleSelection(record.id)}
                      />
                    </td>
                    <td data-label="Product Name" className="rarm-text-strong">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {record.productName}
                        {record.isPinned && (
                          <HeartIcon className="rarm-pin-indicator" />
                        )}
                      </div>
                    </td>
                    <td data-label="Customer Name">{record.customerName}</td>
                    <td data-label="Rating">
                      <div className="rarm-rating-cell">
                        <span className="rarm-rating-text">
                          {record.rating} Stars
                        </span>
                        {renderStars(record.rating)}
                      </div>
                    </td>
                    <td data-label="Review Content">
                      <div className="rarm-content-cell">
                        <p className="rarm-review-truncate">
                          {record.reviewContent}
                        </p>
                      </div>
                    </td>
                    <td data-label="Price">${record.price.toFixed(2)}</td>
                    <td data-label="Status">
                      {renderStatusBadge(record.status)}
                    </td>
                    <td data-label="Actions">
                      {/* Cụm nút thao tác */}
                      <div className="rarm-action-group">
                        <button
                          type="button"
                          className="rarm-btn-action-icon"
                          onClick={() => actions.openDrawer(record, "view")}
                          title="View Details"
                        >
                          <EyeIcon />
                        </button>
                        <button
                          type="button"
                          className="rarm-btn-action-icon"
                          onClick={() => actions.openDrawer(record, "edit")}
                          title="Edit Moderation"
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className={`rarm-btn-action-text ${record.isUserBanned ? "disabled" : ""} ${record.status === "Hidden" ? "pressed" : ""}`}
                          onClick={() => actions.toggleHideStatus(record.id)}
                          disabled={record.isUserBanned}
                          title={
                            record.isUserBanned
                              ? "User is banned"
                              : "Toggle Visibility"
                          }
                        >
                          {record.status === "Hidden" ? (
                            <LockIcon />
                          ) : (
                            <UnlockIcon />
                          )}
                          Hide
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="rarm-empty-state">
                    No reviews found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <div className="rarm-pagination">
          <span className="rarm-pagination-info">
            Showing{" "}
            {pagination.totalFiltered === 0 ? 0 : pagination.startIndex + 1} to{" "}
            {Math.min(
              pagination.startIndex + pagination.limit,
              pagination.totalFiltered,
            )}{" "}
            of {pagination.totalFiltered} reviews
          </span>
          <div className="rarm-page-numbers">
            <button
              className="rarm-page-num"
              disabled={pagination.page === 1}
              onClick={() => actions.changePage(pagination.page - 1)}
            >
              &lt;
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (num) => (
                <button
                  key={num}
                  className={`rarm-page-num ${pagination.page === num ? "active" : ""}`}
                  onClick={() => actions.changePage(num)}
                >
                  {num}
                </button>
              ),
            )}
            <button
              className="rarm-page-num"
              disabled={
                pagination.page === pagination.totalPages ||
                pagination.totalPages === 0
              }
              onClick={() => actions.changePage(pagination.page + 1)}
            >
              &gt;
            </button>

            {/* Dropdown giới hạn số bản ghi */}
            <div className="rarm-limit-dropdown" ref={limitRef}>
              <div
                className={`rarm-limit-trigger ${isLimitDropdownOpen ? "active" : ""}`}
                onClick={() => setIsLimitDropdownOpen(!isLimitDropdownOpen)}
              >
                <span>{pagination.limit} / page</span>
                <div
                  className={`rarm-limit-icon ${isLimitDropdownOpen ? "open" : ""}`}
                >
                  <ChevronDownSmallIcon />
                </div>
              </div>
              {isLimitDropdownOpen && (
                <div className="rarm-limit-options">
                  {[10, 20, 50].map((val) => (
                    <div
                      key={val}
                      className={`rarm-limit-option ${pagination.limit === val ? "active" : ""}`}
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
