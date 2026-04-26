import { useState, useRef } from "react";
import "./CouponManagement.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
// icon
import {
  SearchIcon,
  ChevronDownIcon,
  EditIcon,
  ViewIcon,
} from "../../../../assets/icons/CouponManagementIcons";

import type {
  CouponRecord,
  CouponStatus,
  DiscountType,
} from "../../../../hooks/portal/MarketingSuite/CouponManagement/useCouponManagement";

// props
interface CouponManagementProps {
  data: CouponRecord[];
  search: string;
  statusFilter: CouponStatus | "All";
  discountTypeFilter: DiscountType | "All";
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
    changeStatusFilter: (status: CouponStatus | "All") => void;
    changeDiscountTypeFilter: (type: DiscountType | "All") => void;
    clearFilters: () => void;
    toggleSelection: (id: string) => void;
    toggleSelectAll: (isSelectAll: boolean) => void;
    openAddModal: () => void;
    openEditModal: (record: CouponRecord) => void;
    openViewModal: (record: CouponRecord) => void;
    changePage: (page: number) => void;
    changeLimit: (limit: number) => void;
  };
  bulkActions: {
    bulkActivate: () => void;
    bulkDeactivate: () => void;
    bulkDelete: () => void;
  };
}

export default function CouponManagement({
  data,
  search,
  statusFilter,
  discountTypeFilter,
  selectedIds,
  pagination,
  actions,
  bulkActions,
}: CouponManagementProps) {
  // State quản lý dropdown
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isLimitDropdownOpen, setIsLimitDropdownOpen] = useState(false);

  // Ref xử lý click outside
  const statusRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const limitRef = useRef<HTMLDivElement>(null);

  useClickOutside(statusRef, () => setIsStatusOpen(false));
  useClickOutside(typeRef, () => setIsTypeOpen(false));
  useClickOutside(limitRef, () => setIsLimitDropdownOpen(false));

  // Trạng thái checkbox tổng
  const isAllSelected =
    data.length > 0 && data.every((r) => selectedIds.has(r.id));
  const isPartiallySelected =
    data.some((r) => selectedIds.has(r.id)) && !isAllSelected;

  // Render badge trạng thái
  const renderStatusBadge = (status: CouponStatus) => {
    switch (status) {
      case "Active":
        return <span className="coupon-badge coupon-badge-active">Active</span>;
      case "Inactive":
        return (
          <span className="coupon-badge coupon-badge-inactive">Inactive</span>
        );
      case "Scheduled":
        return (
          <span className="coupon-badge coupon-badge-scheduled">Scheduled</span>
        );
      case "Expired":
        return (
          <span className="coupon-badge coupon-badge-expired">Expired</span>
        );
      case "Draft":
        return <span className="coupon-badge coupon-badge-draft">Draft</span>;
      default:
        return null;
    }
  };

  // Render phạm vi áp dụng
  const renderScope = (scope: CouponRecord["applicableScope"]) => {
    if (scope.isAllProducts) return "All Products";
    const parts = [];
    if (scope.categories.length > 0)
      parts.push(`${scope.categories.length} Categories`);
    if (scope.tags.length > 0) parts.push(`${scope.tags.length} Tags`);
    if (scope.products.length > 0)
      parts.push(`${scope.products.length} Products`);
    return parts.length > 0 ? parts.join(", ") : "None";
  };

  return (
    <div className="coupon-container">
      {/* Header */}
      <div className="coupon-header">
        <div>
          <h1 className="coupon-title">Coupon Management</h1>
          <p className="coupon-breadcrumb">
            Marketing Suite / Coupon Management
          </p>
        </div>
        <button
          type="button"
          className="coupon-btn-add"
          onClick={actions.openAddModal}
        >
          Create Coupon
        </button>
      </div>

      {/* Bộ lọc và thanh công cụ */}
      <div className="coupon-filters-card">
        <div className="coupon-toolbar">
          <div className="coupon-filters-row">
            {/* Thanh tìm kiếm */}
            <div className="coupon-search-wrapper">
              <SearchIcon />
              <input
                type="text"
                className="coupon-filter-input with-icon"
                placeholder="Search by name, type"
                value={search}
                onChange={(e) => actions.changeSearch(e.target.value)}
              />
            </div>

            {/* Dropdown trạng thái */}
            <div className="coupon-custom-dropdown" ref={statusRef}>
              <div
                className={`coupon-dropdown-trigger ${isStatusOpen ? "active" : ""}`}
                onClick={() => setIsStatusOpen(!isStatusOpen)}
              >
                <span>
                  Status: {statusFilter === "All" ? "All" : statusFilter}
                </span>
                <ChevronDownIcon />
              </div>
              {isStatusOpen && (
                <div className="coupon-dropdown-options">
                  {(
                    [
                      "All",
                      "Active",
                      "Inactive",
                      "Scheduled",
                      "Expired",
                      "Draft",
                    ] as const
                  ).map((opt) => (
                    <div
                      key={opt}
                      className={`coupon-dropdown-option ${statusFilter === opt ? "active" : ""}`}
                      onClick={() => {
                        actions.changeStatusFilter(opt);
                        setIsStatusOpen(false);
                      }}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dropdown loại giảm giá */}
            <div className="coupon-custom-dropdown" ref={typeRef}>
              <div
                className={`coupon-dropdown-trigger ${isTypeOpen ? "active" : ""}`}
                onClick={() => setIsTypeOpen(!isTypeOpen)}
              >
                <span>
                  Type:{" "}
                  {discountTypeFilter === "All" ? "All" : discountTypeFilter}
                </span>
                <ChevronDownIcon />
              </div>
              {isTypeOpen && (
                <div className="coupon-dropdown-options">
                  {(["All", "Percentage", "Fixed Amount"] as const).map(
                    (opt) => (
                      <div
                        key={opt}
                        className={`coupon-dropdown-option ${discountTypeFilter === opt ? "active" : ""}`}
                        onClick={() => {
                          actions.changeDiscountTypeFilter(opt);
                          setIsTypeOpen(false);
                        }}
                      >
                        {opt}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className="coupon-btn-clear"
              onClick={actions.clearFilters}
            >
              Clear Filter
            </button>
          </div>

          {/* Thao tác hàng loạt */}
          <div className="coupon-bulk-actions">
            <button
              type="button"
              className="coupon-btn-bulk"
              onClick={bulkActions.bulkActivate}
              disabled={selectedIds.size === 0}
            >
              Bulk Activate
            </button>
            <button
              type="button"
              className="coupon-btn-bulk"
              onClick={bulkActions.bulkDeactivate}
              disabled={selectedIds.size === 0}
            >
              Bulk Deactivate
            </button>
            <button
              type="button"
              className="coupon-btn-bulk danger"
              onClick={bulkActions.bulkDelete}
              disabled={selectedIds.size === 0}
            >
              Bulk Delete
            </button>
          </div>
        </div>

        {/* Bảng dữ liệu */}
        <div className="coupon-table-wrapper">
          <table className="coupon-table">
            <thead>
              <tr>
                <th style={{ width: "4%" }}>
                  <input
                    type="checkbox"
                    className="coupon-checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isPartiallySelected;
                    }}
                    onChange={(e) => actions.toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th style={{ width: "14%" }}>Coupon Code</th>
                <th style={{ width: "12%" }}>Discount Type</th>
                <th style={{ width: "12%" }}>Discount Value</th>
                <th style={{ width: "14%" }}>Applicable Scope</th>
                <th style={{ width: "12%" }}>
                  Usage Limit
                  <br />
                  (Per/Total)
                </th>
                <th style={{ width: "10%" }}>Status</th>
                <th style={{ width: "8%" }}>Start Date</th>
                <th style={{ width: "8%" }}>End Date</th>
                <th style={{ width: "6%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((record) => (
                  <tr
                    key={record.id}
                    className={
                      selectedIds.has(record.id) ? "coupon-selected-row" : ""
                    }
                  >
                    <td data-label="Select">
                      <input
                        type="checkbox"
                        className="coupon-checkbox"
                        checked={selectedIds.has(record.id)}
                        onChange={() => actions.toggleSelection(record.id)}
                      />
                    </td>
                    <td data-label="Coupon Code" className="coupon-text-strong">
                      {record.code}
                    </td>
                    <td data-label="Discount Type">{record.discountType}</td>
                    <td data-label="Discount Value">{record.discountValue}</td>

                    <td data-label="Applicable Scope">
                      {renderScope(record.applicableScope)}
                    </td>

                    <td data-label="Usage Limit">
                      {record.perCustomerLimit || record.usedCount}/
                      {record.totalUses}
                    </td>
                    <td data-label="Status">
                      {renderStatusBadge(record.status)}
                    </td>
                    <td data-label="Start Date">{record.startDate}</td>
                    <td data-label="End Date">{record.endDate}</td>
                    <td data-label="Actions">
                      {/* Cụm nút hành động */}
                      <div className="coupon-row-actions">
                        <button
                          type="button"
                          className="coupon-icon-btn"
                          title="Edit Coupon"
                          onClick={() => actions.openEditModal(record)}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="coupon-icon-btn"
                          title="View Details"
                          onClick={() => actions.openViewModal(record)}
                        >
                          <ViewIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="coupon-empty-state">
                    No coupons found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <div className="coupon-pagination">
          <span className="coupon-pagination-info">
            Showing{" "}
            {pagination.totalFiltered === 0 ? 0 : pagination.startIndex + 1} to{" "}
            {Math.min(
              pagination.startIndex + pagination.limit,
              pagination.totalFiltered,
            )}{" "}
            of {pagination.totalFiltered} coupons
          </span>
          <div className="coupon-page-numbers">
            <button
              className="coupon-page-num"
              disabled={pagination.page === 1}
              onClick={() => actions.changePage(pagination.page - 1)}
            >
              &lt;
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (num) => (
                <button
                  key={num}
                  className={`coupon-page-num ${pagination.page === num ? "active" : ""}`}
                  onClick={() => actions.changePage(num)}
                >
                  {num}
                </button>
              ),
            )}
            <button
              className="coupon-page-num"
              disabled={
                pagination.page === pagination.totalPages ||
                pagination.totalPages === 0
              }
              onClick={() => actions.changePage(pagination.page + 1)}
            >
              &gt;
            </button>

            {/* Dropdown */}
            <div className="coupon-limit-dropdown" ref={limitRef}>
              <div
                className={`coupon-limit-trigger ${isLimitDropdownOpen ? "active" : ""}`}
                onClick={() => setIsLimitDropdownOpen(!isLimitDropdownOpen)}
              >
                <span>{pagination.limit} / page</span>
                <div
                  className={`coupon-limit-icon ${isLimitDropdownOpen ? "open" : ""}`}
                >
                  <ChevronDownIcon />
                </div>
              </div>
              {isLimitDropdownOpen && (
                <div className="coupon-limit-options">
                  {[10, 20, 50].map((val) => (
                    <div
                      key={val}
                      className={`coupon-limit-option ${pagination.limit === val ? "active" : ""}`}
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
