import { useState, useRef } from "react";
import "./PriceManagement.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  DraftIcon,
  EditIcon,
  ChevronDownSmallIcon,
} from "../../../../assets/icons/PriceManagementIcons";

import type {
  PriceRecord,
  PriceStatus,
} from "../../../../hooks/portal/ProductCatalog/PriceManagement/usePriceManagement";

interface PriceManagementProps {
  data: PriceRecord[];
  search: string;
  statusFilter: PriceStatus | "All";
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
    changeStatusFilter: (status: PriceStatus | "All") => void;
    clearFilters: () => void;
    toggleSelection: (id: string) => void;
    toggleSelectAll: (isSelectAll: boolean) => void;
    openSetPriceModal: (record: PriceRecord) => void;
    changePage: (page: number) => void;
    changeLimit: (limit: number) => void;
  };
  rowActions: {
    submitPrice: (id: string) => void;
    approvePrice: (id: string) => void;
    rejectPrice: (id: string) => void;
  };
  bulkActions: {
    bulkApprove: () => void;
    bulkReject: () => void;
  };
}

export default function PriceManagement({
  data,
  search,
  statusFilter,
  selectedIds,
  pagination,
  actions,
  rowActions,
  bulkActions,
}: PriceManagementProps) {
  // dropdown
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  useClickOutside(statusRef, () => setIsStatusDropdownOpen(false));

  const [isLimitDropdownOpen, setIsLimitDropdownOpen] = useState(false);
  const limitRef = useRef<HTMLDivElement>(null);
  useClickOutside(limitRef, () => setIsLimitDropdownOpen(false));

  const isAllSelected = data.length > 0 && selectedIds.size === data.length;
  const isPartiallySelected =
    selectedIds.size > 0 && selectedIds.size < data.length;

  const renderStatusBadge = (status: PriceStatus) => {
    switch (status) {
      case "Approved":
        return (
          <span className="prm-badge prm-badge-approve">
            <CheckCircleIcon /> Approve
          </span>
        );
      case "Rejected":
        return (
          <span className="prm-badge prm-badge-rejected">
            <XCircleIcon /> Rejected
          </span>
        );
      case "Pending":
        return (
          <span className="prm-badge prm-badge-pending">
            <ClockIcon /> Pending
          </span>
        );
      case "Draft":
        return (
          <span className="prm-badge prm-badge-draft">
            <DraftIcon /> Draft
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="prm-container">
      <div className="prm-header">
        <div>
          <h1 className="prm-title">Price Management</h1>
          <p className="prm-breadcrumb">Product Catalog / Price Management</p>
        </div>
      </div>

      <div className="prm-card">
        {/* toolbar */}
        <div className="prm-toolbar">
          <div className="prm-filters">
            <input
              type="text"
              className="prm-search-input"
              placeholder="Search by name, SKU"
              value={search}
              onChange={(e) => actions.changeSearch(e.target.value)}
            />

            <div className="prm-custom-select" ref={statusRef}>
              <div
                className="prm-select-trigger"
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              >
                <span>{statusFilter === "All" ? "Status" : statusFilter}</span>
                <ChevronDownSmallIcon />
              </div>
              {isStatusDropdownOpen && (
                <div className="prm-select-dropdown">
                  {(
                    ["All", "Approved", "Pending", "Rejected", "Draft"] as const
                  ).map((opt) => (
                    <div
                      key={opt}
                      className={`prm-select-item ${statusFilter === opt ? "active" : ""}`}
                      onClick={() => {
                        actions.changeStatusFilter(opt);
                        setIsStatusDropdownOpen(false);
                      }}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="prm-custom-select disabled">
              <div className="prm-select-trigger">
                <span>Price</span>
                <ChevronDownSmallIcon />
              </div>
            </div>

            <button
              type="button"
              className="prm-btn-clear"
              onClick={actions.clearFilters}
            >
              Clear Filter
            </button>
          </div>

          <div className="prm-bulk-actions">
            <button
              type="button"
              className="prm-btn-bulk outline"
              onClick={bulkActions.bulkApprove}
              disabled={selectedIds.size === 0}
            >
              Bulk Approve
            </button>
            <button
              type="button"
              className="prm-btn-bulk outline"
              onClick={bulkActions.bulkReject}
              disabled={selectedIds.size === 0}
            >
              Bulk Reject
            </button>
          </div>
        </div>

        {/* bảng duyệt giá */}
        <div className="prm-table-wrapper">
          <table className="prm-table">
            <thead>
              <tr>
                <th style={{ width: "5%" }}>
                  <input
                    type="checkbox"
                    className="prm-checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isPartiallySelected;
                    }}
                    onChange={(e) => actions.toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th style={{ width: "25%" }}>Product Name</th>
                <th style={{ width: "15%" }}>SKU</th>
                <th style={{ width: "20%" }}>Variant</th>
                <th style={{ width: "12%" }}>Status</th>
                <th style={{ width: "10%" }}>Price</th>
                <th style={{ width: "13%" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((record) => (
                  <tr
                    key={record.id}
                    className={selectedIds.has(record.id) ? "selected-row" : ""}
                  >
                    <td>
                      <input
                        type="checkbox"
                        className="prm-checkbox"
                        checked={selectedIds.has(record.id)}
                        onChange={() => actions.toggleSelection(record.id)}
                      />
                    </td>
                    <td className="font-medium">{record.productName}</td>
                    <td>{record.sku}</td>
                    <td>{record.variant}</td>
                    <td>{renderStatusBadge(record.status)}</td>
                    <td>${record.price.toFixed(2)}</td>
                    <td>
                      <div className="prm-row-actions">
                        {record.status === "Draft" && (
                          <>
                            <button
                              type="button"
                              className="prm-btn-action edit"
                              onClick={() => actions.openSetPriceModal(record)}
                            >
                              <EditIcon /> Edit
                            </button>
                            <button
                              type="button"
                              className="prm-btn-action submit"
                              onClick={() => rowActions.submitPrice(record.id)}
                            >
                              Submit
                            </button>
                          </>
                        )}
                        {record.status === "Pending" && (
                          <>
                            <button
                              type="button"
                              className="prm-btn-action approve"
                              onClick={() => rowActions.approvePrice(record.id)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="prm-btn-action reject"
                              onClick={() => rowActions.rejectPrice(record.id)}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {record.status === "Rejected" && (
                          <button
                            type="button"
                            className="prm-btn-action edit"
                            onClick={() => actions.openSetPriceModal(record)}
                          >
                            <EditIcon /> Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="prm-empty-state">
                    No records found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="prm-pagination">
          <span className="prm-pagination-info">
            Showing{" "}
            {pagination.totalFiltered === 0 ? 0 : pagination.startIndex + 1} to{" "}
            {Math.min(
              pagination.startIndex + pagination.limit,
              pagination.totalFiltered,
            )}{" "}
            of {pagination.totalFiltered} items
          </span>
          <div className="prm-pagination-controls">
            <button
              className="prm-page-btn"
              disabled={pagination.page === 1}
              onClick={() => actions.changePage(pagination.page - 1)}
            >
              &lt;
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (num) => (
                <button
                  key={num}
                  className={`prm-page-btn ${pagination.page === num ? "active" : ""}`}
                  onClick={() => actions.changePage(num)}
                >
                  {num}
                </button>
              ),
            )}
            <button
              className="prm-page-btn"
              disabled={
                pagination.page === pagination.totalPages ||
                pagination.totalPages === 0
              }
              onClick={() => actions.changePage(pagination.page + 1)}
            >
              &gt;
            </button>

            {/* CUSTOM DROPDOWN CHO PHÂN TRANG */}
            <div className="prm-limit-dropdown" ref={limitRef}>
              <div
                className={`prm-limit-trigger ${isLimitDropdownOpen ? "active" : ""}`}
                onClick={() => setIsLimitDropdownOpen(!isLimitDropdownOpen)}
              >
                <span>{pagination.limit} / page</span>
                <div
                  className={`prm-limit-icon ${isLimitDropdownOpen ? "open" : ""}`}
                >
                  <ChevronDownSmallIcon />
                </div>
              </div>
              {isLimitDropdownOpen && (
                <div className="prm-limit-options">
                  {[10, 20, 50].map((val) => (
                    <div
                      key={val}
                      className={`prm-limit-option ${pagination.limit === val ? "active" : ""}`}
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
