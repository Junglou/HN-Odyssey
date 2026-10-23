import { useState, useRef } from "react";
import "./CouponManagement.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import TableSkeleton from "../../common/TableSkeleton/TableSkeleton";
import PortalPagination from "../../common/Pagination/PortalPagination";
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
import { getCurrentUser, hasPermission } from "../../../../utils/permission";
import { Action, Resource } from "../../../../types/permissions";

// types
interface CouponManagementProps {
  data: CouponRecord[];
  isLoading?: boolean;
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

interface DropdownOption {
  label: string;
  value: string;
}

// helpers
function CustomDropdown({
  value,
  options,
  onChange,
  prefix = "",
}: {
  value: string;
  options: DropdownOption[];
  onChange: (val: string) => void;
  prefix?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || value;

  return (
    <div className="coupon-custom-dropdown" ref={dropdownRef}>
      <div
        className={`coupon-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        <span>
          {prefix}
          {selectedLabel}
        </span>
        <div className={`coupon-dropdown-arrow ${isOpen ? "open" : ""}`}>
          <ChevronDownIcon />
        </div>
      </div>
      <div
        className={`coupon-dropdown-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`coupon-dropdown-option ${value === opt.value ? "active" : ""}`}
            onClick={() => {
              onChange(opt.value);
              setIsOpen(false);
            }}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// constants - Map đúng chuỗi BE cần để gọi API Filter
const STATUS_OPTIONS: DropdownOption[] = [
  { label: "All", value: "All" },
  { label: "Active", value: "ACTIVE" },
  { label: "Draft", value: "DRAFT" },
  { label: "Inactive", value: "INACTIVE" },
  { label: "Cancelled", value: "CANCELLED" },
];

const TYPE_OPTIONS: DropdownOption[] = [
  { label: "All", value: "All" },
  { label: "Percentage", value: "PERCENTAGE" },
  { label: "Fixed Amount", value: "FIXED_AMOUNT" },
];

// component
export default function CouponManagement({
  data,
  isLoading = false,
  search,
  statusFilter,
  discountTypeFilter,
  selectedIds,
  pagination,
  actions,
  bulkActions,
}: CouponManagementProps) {
  const canChangeStatus = hasPermission(
    getCurrentUser(),
    Resource.PROMO_COUPONS,
    Action.CHANGE_STATUS,
  );

  const isAllSelected =
    data.length > 0 && data.every((r) => selectedIds.has(r.id));
  const isPartiallySelected =
    data.some((r) => selectedIds.has(r.id)) && !isAllSelected;

  // render helpers - Chuẩn hóa uppercase để khớp với BE
  const renderStatusBadge = (status: string) => {
    const normalizedStatus = status?.toUpperCase();

    switch (normalizedStatus) {
      case "ACTIVE":
        return <span className="coupon-badge coupon-badge-active">Active</span>;
      case "INACTIVE":
        return (
          <span className="coupon-badge coupon-badge-inactive">Inactive</span>
        );
      case "SCHEDULED":
        return (
          <span className="coupon-badge coupon-badge-scheduled">Scheduled</span>
        );
      case "EXPIRED":
      case "CANCELLED":
        return (
          <span className="coupon-badge coupon-badge-expired">
            {normalizedStatus === "CANCELLED" ? "Cancelled" : "Expired"}
          </span>
        );
      case "DRAFT":
        return <span className="coupon-badge coupon-badge-draft">Draft</span>;
      default:
        // Đề phòng BE trả về status lạ, vẫn hiển thị chữ thay vì null (tàng hình)
        return (
          <span className="coupon-badge coupon-badge-inactive">{status}</span>
        );
    }
  };

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

  // render
  return (
    <div className="coupon-container">
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

      <div className="coupon-filters-card">
        <div className="coupon-toolbar">
          <div className="coupon-filters-row">
            <div className="coupon-search-wrapper">
              <SearchIcon />
              <input
                type="text"
                className="coupon-filter-input with-icon"
                placeholder="Search by code"
                value={search}
                onChange={(e) => actions.changeSearch(e.target.value)}
              />
            </div>

            <CustomDropdown
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={(val) =>
                actions.changeStatusFilter(val as CouponStatus | "All")
              }
              prefix="Status: "
            />

            <CustomDropdown
              value={discountTypeFilter}
              options={TYPE_OPTIONS}
              onChange={(val) =>
                actions.changeDiscountTypeFilter(val as DiscountType | "All")
              }
              prefix="Type: "
            />

            <button
              type="button"
              className="coupon-btn-clear"
              onClick={actions.clearFilters}
            >
              Clear Filter
            </button>
          </div>

          <div className="coupon-bulk-actions">
            {canChangeStatus && (
              <>
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
              </>
            )}
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
            <tbody
              className={`portal-tbody ${isLoading && data.length > 0 ? "is-refreshing" : ""}`}
            >
              {isLoading && data.length === 0 ? (
                <TableSkeleton columns={10} />
              ) : data.length > 0 ? (
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
                  <td colSpan={10} className="portal-empty-state">
                    No coupons found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PortalPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalFiltered}
          pageSize={pagination.limit}
          onPageChange={actions.changePage}
          onPageSizeChange={actions.changeLimit}
          itemLabel="coupons"
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
