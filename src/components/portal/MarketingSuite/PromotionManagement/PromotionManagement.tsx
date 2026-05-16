import { useState, useRef } from "react";
import "./PromotionManagement.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import {
  SearchIcon,
  ChevronDownIcon,
  EditIcon,
  ViewIcon,
} from "../../../../assets/icons/PromotionManagementIcons";

import type {
  PromotionRecord,
  PromotionStatus,
  PromotionType,
} from "../../../../hooks/portal/MarketingSuite/PromotionManagement/usePromotionManagement";

interface PromotionManagementProps {
  data: PromotionRecord[];
  search: string;
  statusFilter: PromotionStatus | "All";
  typeFilter: PromotionType | "All";
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
    changeStatusFilter: (status: PromotionStatus | "All") => void;
    changeTypeFilter: (type: PromotionType | "All") => void;
    clearFilters: () => void;
    toggleSelection: (id: string) => void;
    toggleSelectAll: (isSelectAll: boolean) => void;
    openAddModal: () => void;
    openEditModal: (record: PromotionRecord) => void;
    openViewModal: (record: PromotionRecord) => void;
    openDeleteModal: (record?: PromotionRecord) => void;
    changePage: (page: number) => void;
    changeLimit: (limit: number) => void;
  };
  bulkActions: {
    bulkActivate: () => void;
    bulkDeactivate: () => void;
    bulkDelete: () => void;
  };
}

export default function PromotionManagement({
  data,
  search,
  statusFilter,
  typeFilter,
  selectedIds,
  pagination,
  actions,
  bulkActions,
}: PromotionManagementProps) {
  // quản lý trạng thái đóng/mở dropdown
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [hasStatusOpened, setHasStatusOpened] = useState(false);

  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [hasTypeOpened, setHasTypeOpened] = useState(false);

  const statusRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);

  const [isLimitDropdownOpen, setIsLimitDropdownOpen] = useState(false);
  const [hasLimitOpened, setHasLimitOpened] = useState(false);
  const limitRef = useRef<HTMLDivElement>(null);
  useClickOutside(limitRef, () => setIsLimitDropdownOpen(false));

  useClickOutside(statusRef, () => setIsStatusOpen(false));
  useClickOutside(typeRef, () => setIsTypeOpen(false));

  const isAllSelected =
    data.length > 0 && data.every((r) => selectedIds.has(r.id));
  const isPartiallySelected =
    data.some((r) => selectedIds.has(r.id)) && !isAllSelected;

  const renderStatusBadge = (status: PromotionStatus) => {
    switch (status) {
      case "Active":
        return <span className="promo-badge promo-badge-active">Active</span>;
      case "Inactive":
        return (
          <span className="promo-badge promo-badge-inactive">Inactive</span>
        );
      case "Scheduled":
        return (
          <span className="promo-badge promo-badge-scheduled">Scheduled</span>
        );
      case "Expired":
        return <span className="promo-badge promo-badge-expired">Expired</span>;
      case "Draft":
        return <span className="promo-badge promo-badge-draft">Draft</span>;
      default:
        return null;
    }
  };

  return (
    <div className="promo-container">
      <div className="promo-header">
        <div>
          <h1 className="promo-title">Promotion Management</h1>
          <p className="promo-breadcrumb">
            Marketing Suite / Promotion Management
          </p>
        </div>
        <button
          type="button"
          className="promo-btn-add"
          onClick={actions.openAddModal}
        >
          Create Promotion
        </button>
      </div>

      <div className="promo-filters-card">
        <div className="promo-toolbar">
          <div className="promo-filters-row">
            <div className="promo-search-wrapper">
              <SearchIcon />
              <input
                type="text"
                className="promo-filter-input with-icon"
                placeholder="Search by name"
                value={search}
                onChange={(e) => actions.changeSearch(e.target.value)}
              />
            </div>

            <div className="promo-custom-dropdown" ref={statusRef}>
              <div
                className="promo-dropdown-trigger"
                onClick={() => {
                  setIsStatusOpen(!isStatusOpen);
                  if (!hasStatusOpened) setHasStatusOpened(true);
                }}
              >
                <span>{statusFilter === "All" ? "Status" : statusFilter}</span>
                <div
                  className={`promo-dropdown-arrow ${isStatusOpen ? "open" : ""}`}
                >
                  <ChevronDownIcon />
                </div>
              </div>
              <div
                className={`promo-dropdown-options ${isStatusOpen ? "open" : hasStatusOpened ? "closed" : ""}`}
              >
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
                    className={`promo-dropdown-option ${statusFilter === opt ? "active" : ""}`}
                    onClick={() => {
                      actions.changeStatusFilter(opt);
                      setIsStatusOpen(false);
                    }}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            </div>

            <div className="promo-custom-dropdown" ref={typeRef}>
              <div
                className="promo-dropdown-trigger"
                onClick={() => {
                  setIsTypeOpen(!isTypeOpen);
                  if (!hasTypeOpened) setHasTypeOpened(true);
                }}
              >
                <span>
                  {typeFilter === "All" ? "Promotion Type" : typeFilter}
                </span>
                <div
                  className={`promo-dropdown-arrow ${isTypeOpen ? "open" : ""}`}
                >
                  <ChevronDownIcon />
                </div>
              </div>
              <div
                className={`promo-dropdown-options ${isTypeOpen ? "open" : hasTypeOpened ? "closed" : ""}`}
              >
                {(["All", "Flash Sale", "Discount"] as const).map((opt) => (
                  <div
                    key={opt}
                    className={`promo-dropdown-option ${typeFilter === opt ? "active" : ""}`}
                    onClick={() => {
                      actions.changeTypeFilter(opt);
                      setIsTypeOpen(false);
                    }}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="promo-btn-clear"
              onClick={actions.clearFilters}
            >
              Clear Filter
            </button>
          </div>

          <div className="promo-bulk-actions">
            <button
              type="button"
              className="promo-btn-bulk"
              onClick={bulkActions.bulkActivate}
              disabled={selectedIds.size === 0}
            >
              Bulk Activate
            </button>
            <button
              type="button"
              className="promo-btn-bulk"
              onClick={bulkActions.bulkDeactivate}
              disabled={selectedIds.size === 0}
            >
              Bulk Deactivate
            </button>
            <button
              type="button"
              className="promo-btn-bulk danger"
              onClick={bulkActions.bulkDelete}
              disabled={selectedIds.size === 0}
            >
              Bulk Delete
            </button>
          </div>
        </div>

        {/* bảng */}
        <div className="promo-table-wrapper">
          <table className="promo-table">
            <thead>
              <tr>
                <th style={{ width: "5%" }}>
                  <input
                    type="checkbox"
                    className="promo-checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isPartiallySelected;
                    }}
                    onChange={(e) => actions.toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th style={{ width: "20%" }}>Promotion Name</th>
                <th style={{ width: "15%" }}>Promotion Type</th>
                <th style={{ width: "15%" }}>Discount Value</th>
                <th style={{ width: "15%" }}>Applicable Scope</th>
                <th style={{ width: "10%" }}>Status</th>
                <th style={{ width: "10%" }}>Start Date</th>
                <th style={{ width: "10%" }}>End Date</th>
                <th style={{ width: "10%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((record) => (
                  <tr
                    key={record.id}
                    className={
                      selectedIds.has(record.id) ? "promo-selected-row" : ""
                    }
                  >
                    <td data-label="Select">
                      <input
                        type="checkbox"
                        className="promo-checkbox"
                        checked={selectedIds.has(record.id)}
                        onChange={() => actions.toggleSelection(record.id)}
                      />
                    </td>
                    <td
                      data-label="Promotion Name"
                      className="promo-text-strong"
                    >
                      {record.name}
                    </td>
                    <td data-label="Promotion Type">{record.type}</td>
                    <td data-label="Discount Value">{record.discountValue}</td>
                    <td data-label="Applicable Scope">
                      {record.applicableScopeType}:{" "}
                      {record.applicableScopeValues.join(", ")}
                    </td>
                    <td data-label="Status">
                      {renderStatusBadge(record.status)}
                    </td>
                    <td data-label="Start Date">{record.startDate}</td>
                    <td data-label="End Date">{record.endDate}</td>
                    <td data-label="Actions">
                      <div className="promo-row-actions">
                        <button
                          type="button"
                          className="promo-icon-btn"
                          title="Edit Promotion"
                          onClick={() => actions.openEditModal(record)}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="promo-icon-btn"
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
                  <td colSpan={9} className="promo-empty-state">
                    No promotions found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* phân trang */}
        <div className="promo-pagination">
          <span className="promo-pagination-info">
            Showing{" "}
            {pagination.totalFiltered === 0 ? 0 : pagination.startIndex + 1} to{" "}
            {Math.min(
              pagination.startIndex + pagination.limit,
              pagination.totalFiltered,
            )}{" "}
            of {pagination.totalFiltered} promotions
          </span>
          <div className="promo-page-numbers">
            <button
              className="promo-page-num"
              disabled={pagination.page === 1}
              onClick={() => actions.changePage(pagination.page - 1)}
            >
              &lt;
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (num) => (
                <button
                  key={num}
                  className={`promo-page-num ${pagination.page === num ? "active" : ""}`}
                  onClick={() => actions.changePage(num)}
                >
                  {num}
                </button>
              ),
            )}
            <button
              className="promo-page-num"
              disabled={
                pagination.page === pagination.totalPages ||
                pagination.totalPages === 0
              }
              onClick={() => actions.changePage(pagination.page + 1)}
            >
              &gt;
            </button>
            <div className="promo-limit-dropdown" ref={limitRef}>
              <div
                className={`promo-limit-trigger ${isLimitDropdownOpen ? "active" : ""}`}
                onClick={() => {
                  setIsLimitDropdownOpen(!isLimitDropdownOpen);
                  if (!hasLimitOpened) setHasLimitOpened(true);
                }}
              >
                <span>{pagination.limit} / page</span>
                <div
                  className={`promo-limit-icon ${isLimitDropdownOpen ? "open" : ""}`}
                >
                  <ChevronDownIcon />
                </div>
              </div>
              <div
                className={`promo-limit-options ${isLimitDropdownOpen ? "open" : hasLimitOpened ? "closed" : ""}`}
              >
                {[10, 20, 50].map((val) => (
                  <div
                    key={val}
                    className={`promo-limit-option ${pagination.limit === val ? "active" : ""}`}
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
