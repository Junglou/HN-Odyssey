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
  actions: {
    changeSearch: (val: string) => void;
    changeStatusFilter: (status: PriceStatus | "All") => void;
    clearFilters: () => void;
    toggleSelection: (id: string) => void;
    toggleSelectAll: (isSelectAll: boolean) => void;
    openSetPriceModal: (record: PriceRecord) => void;
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
  actions,
  rowActions,
  bulkActions,
}: PriceManagementProps) {
  // quản lý trạng thái mở dropdown lọc
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  useClickOutside(statusRef, () => setIsStatusDropdownOpen(false));

  const isAllSelected = data.length > 0 && selectedIds.size === data.length;
  const isPartiallySelected =
    selectedIds.size > 0 && selectedIds.size < data.length;

  // hàm render huy hiệu trạng thái tùy theo status
  const renderStatusBadge = (status: PriceStatus) => {
    switch (status) {
      case "Approve":
        return (
          <span className="pm-badge pm-badge-approve">
            <CheckCircleIcon /> Approve
          </span>
        );
      case "Rejected":
        return (
          <span className="pm-badge pm-badge-rejected">
            <XCircleIcon /> Rejected
          </span>
        );
      case "Pending":
        return (
          <span className="pm-badge pm-badge-pending">
            <ClockIcon /> Pending
          </span>
        );
      case "Draft":
        return (
          <span className="pm-badge pm-badge-draft">
            <DraftIcon /> Draft
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="pm-container">
      <div className="pm-header">
        <div>
          <h1 className="pm-title">Price Management</h1>
          <p className="pm-breadcrumb">Product Catalog / Price Management</p>
        </div>
      </div>

      <div className="pm-card">
        {/* thanh công cụ bộ lọc */}
        <div className="pm-toolbar">
          <div className="pm-filters">
            <input
              type="text"
              className="pm-search-input"
              placeholder="🔍 Search by name, SKU"
              value={search}
              onChange={(e) => actions.changeSearch(e.target.value)}
            />

            <div className="pm-custom-select" ref={statusRef}>
              <div
                className="pm-select-trigger"
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              >
                <span>{statusFilter === "All" ? "Status" : statusFilter}</span>
                <ChevronDownSmallIcon />
              </div>
              {isStatusDropdownOpen && (
                <div className="pm-select-dropdown">
                  {(
                    ["All", "Approve", "Pending", "Rejected", "Draft"] as const
                  ).map((opt) => (
                    <div
                      key={opt}
                      className={`pm-select-item ${statusFilter === opt ? "active" : ""}`}
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

            <div className="pm-custom-select disabled">
              <div className="pm-select-trigger">
                <span>Price</span>
                <ChevronDownSmallIcon />
              </div>
            </div>

            <button
              type="button"
              className="pm-btn-clear"
              onClick={actions.clearFilters}
            >
              Clear Filter
            </button>
          </div>

          <div className="pm-bulk-actions">
            <button
              type="button"
              className="pm-btn-bulk outline"
              onClick={bulkActions.bulkApprove}
              disabled={selectedIds.size === 0}
            >
              Bulk Approve
            </button>
            <button
              type="button"
              className="pm-btn-bulk outline"
              onClick={bulkActions.bulkReject}
              disabled={selectedIds.size === 0}
            >
              Bulk Reject
            </button>
          </div>
        </div>

        {/* bảng danh sách giá */}
        <div className="pm-table-wrapper">
          <table className="pm-table">
            <thead>
              <tr>
                <th style={{ width: "5%" }}>
                  <input
                    type="checkbox"
                    className="pm-checkbox"
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
                        className="pm-checkbox"
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
                      <div className="pm-row-actions">
                        {/* logic hiển thị nút theo từng trạng thái bám sát mockup */}
                        {record.status === "Draft" && (
                          <>
                            <button
                              type="button"
                              className="pm-btn-action edit"
                              onClick={() => actions.openSetPriceModal(record)}
                            >
                              <EditIcon /> Edit
                            </button>
                            <button
                              type="button"
                              className="pm-btn-action submit"
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
                              className="pm-btn-action approve"
                              onClick={() => rowActions.approvePrice(record.id)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="pm-btn-action reject"
                              onClick={() => rowActions.rejectPrice(record.id)}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {record.status === "Rejected" && (
                          <button
                            type="button"
                            className="pm-btn-action edit"
                            onClick={() => actions.openSetPriceModal(record)}
                          >
                            <EditIcon /> Edit
                          </button>
                        )}
                        {/* trạng thái Approve không hiện nút thao tác */}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="pm-empty-state">
                    No records found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* phân trang tĩnh mô phỏng */}
        <div className="pm-pagination">
          <span className="pm-pagination-info">Showing 1-10 of 100 items</span>
          <div className="pm-pagination-controls">
            <button className="pm-page-btn active">1</button>
            <button className="pm-page-btn">2</button>
            <button className="pm-page-btn">3</button>
            <span>...</span>
            <button className="pm-page-btn">15</button>
            <select className="pm-page-select">
              <option>10 / page</option>
              <option>20 / page</option>
              <option>50 / page</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
