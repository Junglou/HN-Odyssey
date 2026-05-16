import React, { useState, useRef, useEffect } from "react";
import { useRequestTab } from "../../../../hooks/portal/Warehouse/useRequestTab";
import { ChevronDownIcon } from "../../../../assets/icons/HeaderIcons";
import {
  ExpandRowIcon,
  RefreshIcon,
} from "../../../../assets/icons/StockManagementIcons";
import "./RequestTab.css";

// options
const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "import", label: "Import" },
  { value: "export", label: "Export" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

// custom dropdown
function CustomDropdown({
  value,
  options,
  onChange,
  className = "",
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false); // Thêm state
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || options[0].label;

  return (
    <div className={`rt-custom-dropdown ${className}`} ref={dropdownRef}>
      <div
        className={`rt-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        <span>{selectedLabel}</span>
        <ChevronDownIcon
          className={`rt-dropdown-arrow ${isOpen ? "open" : ""}`}
        />
      </div>

      <div
        className={`rt-dropdown-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`rt-dropdown-option ${value === opt.value ? "selected" : ""}`}
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

// props
interface RequestTabProps {
  data: ReturnType<typeof useRequestTab>["data"];
  filters: ReturnType<typeof useRequestTab>["filters"];
  pagination: ReturnType<typeof useRequestTab>["pagination"];
  actions: ReturnType<typeof useRequestTab>["actions"];
  showHeader?: boolean;
}

export default function RequestTab({
  data,
  filters,
  pagination,
  actions,
  showHeader = true,
}: RequestTabProps) {
  // states
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const [hasLimitOpened, setHasLimitOpened] = useState(false);
  const limitRef = useRef<HTMLDivElement>(null);

  // Pagination
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        limitRef.current &&
        !limitRef.current.contains(event.target as Node)
      ) {
        setIsLimitOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [rejectModal, setRejectModal] = useState({
    isOpen: false,
    id: "",
    reason: "",
  });

  // handlers
  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    actions.refreshData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // helpers
  const renderStatus = (status: string) => {
    if (status === "pending")
      return (
        <span className="rt-status rt-status-pending">
          <span className="rt-dot"></span> Pending
        </span>
      );
    if (status === "accepted")
      return (
        <span className="rt-status rt-status-accepted">
          <span className="rt-dot"></span> Accepted
        </span>
      );
    return (
      <span className="rt-status rt-status-rejected">
        <span className="rt-dot"></span> Rejected
      </span>
    );
  };

  // main render
  return (
    <div className="rt-wrapper">
      {/* header */}
      {showHeader && (
        <div className="rt-header">
          <h1 className="rt-title">Request Management (WMS)</h1>
          <p className="rt-breadcrumb">Warehouse (WMS) / Request Management</p>
        </div>
      )}

      {/* filters */}
      <div className="rt-card">
        <div className="rt-filters-row">
          <input
            type="text"
            className="rt-filter-input"
            placeholder="Search Request Code..."
            value={filters.search}
            onChange={(e) => actions.changeFilter("search", e.target.value)}
          />
          <CustomDropdown
            value={filters.type}
            options={TYPE_OPTIONS}
            onChange={(val) => actions.changeFilter("type", val)}
          />
          <CustomDropdown
            value={filters.status}
            options={STATUS_OPTIONS}
            onChange={(val) => actions.changeFilter("status", val)}
          />
          <button
            type="button"
            className="rt-btn-clear"
            onClick={(e) => {
              actions.clearFilters();
              e.currentTarget.blur();
            }}
          >
            Clear Filters
          </button>
          <button
            type="button"
            className="rt-btn-refresh"
            onClick={(e) => {
              handleRefresh();
              e.currentTarget.blur();
            }}
          >
            <span className={isRefreshing ? "rt-spin-anim" : ""}>
              <RefreshIcon />
            </span>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* table */}
        <div className="rt-table-wrapper">
          <table className="rt-table">
            <thead>
              <tr>
                <th style={{ width: "5%" }}></th>
                <th style={{ width: "20%" }}>Request Code</th>
                <th style={{ width: "15%" }}>Source</th>
                <th style={{ width: "10%", textAlign: "center" }}>Type</th>
                <th style={{ width: "15%" }}>Date</th>
                <th style={{ width: "15%", textAlign: "center" }}>Status</th>
                <th style={{ width: "20%", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", color: "#6b7280" }}
                  >
                    No requests found
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr className="rt-row-main">
                      <td>
                        <button
                          className="rt-expand-btn"
                          onClick={(e) => {
                            toggleRow(item.id);
                            e.currentTarget.blur();
                          }}
                        >
                          <ExpandRowIcon isOpen={expandedRows.has(item.id)} />
                        </button>
                      </td>
                      <td style={{ fontWeight: 600 }}>{item.requestCode}</td>
                      <td>{item.source}</td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`rt-type-badge rt-type-${item.type}`}>
                          {item.type}
                        </span>
                      </td>
                      <td>{new Date(item.createdAt).toLocaleString()}</td>
                      <td style={{ textAlign: "center" }}>
                        {renderStatus(item.status)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {item.status === "pending" ? (
                          <div className="rt-actions-group">
                            <button
                              className="rt-action-btn-text rt-btn-accept-text"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.currentTarget.blur();
                                actions.acceptRequest(item.id);
                              }}
                            >
                              Accept
                            </button>
                            <button
                              className="rt-action-btn-text rt-btn-reject-text"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.currentTarget.blur();
                                setRejectModal({
                                  isOpen: true,
                                  id: item.id,
                                  reason: "",
                                });
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>-</span>
                        )}
                      </td>
                    </tr>
                    {expandedRows.has(item.id) && (
                      <tr className="rt-row-items">
                        <td colSpan={7} className="rt-items-container">
                          <table className="rt-items-table">
                            <thead>
                              <tr>
                                <th style={{ width: "20%" }}>SKU</th>
                                <th style={{ width: "60%" }}>Product Name</th>
                                <th style={{ width: "20%" }}>Quantity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.items.map((sub, idx) => (
                                <tr key={idx}>
                                  <td style={{ fontWeight: 500 }}>{sub.sku}</td>
                                  <td>{sub.productName}</td>
                                  <td>{sub.quantity}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* pagination */}
      <div className="rt-pagination">
        <div>
          Showing{" "}
          {pagination.total === 0
            ? 0
            : (pagination.page - 1) * pagination.limit + 1}
          -{Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
          {pagination.total} items
        </div>

        <div className="rt-page-numbers">
          <button
            type="button"
            className="rt-page-num"
            style={{
              opacity: pagination.page === 1 ? 0.4 : 1,
              pointerEvents: pagination.page === 1 ? "none" : "auto",
            }}
            onClick={(e) => {
              e.currentTarget.blur();
              actions.changePage(Math.max(pagination.page - 1, 1));
            }}
          >
            &lt;
          </button>

          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
            (num) => (
              <button
                key={num}
                type="button"
                className={`rt-page-num ${pagination.page === num ? "active" : ""}`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  actions.changePage(num);
                }}
              >
                {num}
              </button>
            ),
          )}

          <button
            type="button"
            className="rt-page-num"
            style={{
              opacity:
                pagination.page === pagination.totalPages ||
                pagination.totalPages === 0
                  ? 0.4
                  : 1,
              pointerEvents:
                pagination.page === pagination.totalPages ||
                pagination.totalPages === 0
                  ? "none"
                  : "auto",
            }}
            onClick={(e) => {
              e.currentTarget.blur();
              actions.changePage(
                Math.min(pagination.page + 1, pagination.totalPages),
              );
            }}
          >
            &gt;
          </button>

          <div className="rt-limit-dropdown" ref={limitRef}>
            <div
              className={`rt-limit-trigger ${isLimitOpen ? "active" : ""}`}
              onClick={() => {
                setIsLimitOpen(!isLimitOpen);
                if (!hasLimitOpened) setHasLimitOpened(true);
              }}
            >
              <span>{pagination.limit} / page</span>
              <ChevronDownIcon
                className={`rt-limit-icon ${isLimitOpen ? "open" : ""}`}
              />
            </div>

            <div
              className={`rt-limit-options ${isLimitOpen ? "open" : hasLimitOpened ? "closed" : ""}`}
            >
              {[10, 20, 50].map((val) => (
                <div
                  key={val}
                  className={`rt-limit-option ${pagination.limit === val ? "active" : ""}`}
                  onClick={() => {
                    actions.changeLimit?.(val);
                    setIsLimitOpen(false);
                  }}
                >
                  {val} / page
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* reject modal */}
      {rejectModal.isOpen && (
        <div className="rt-modal-overlay">
          <div className="rt-modal">
            <h3 className="rt-modal-title">Reject Request</h3>
            <p className="rt-modal-desc">
              Please provide a reason for rejecting this request.
            </p>
            <textarea
              className="rt-modal-textarea"
              placeholder="Enter reason..."
              value={rejectModal.reason}
              onChange={(e) =>
                setRejectModal({ ...rejectModal, reason: e.target.value })
              }
              autoFocus
            />
            <div className="rt-modal-footer">
              <button
                className="rt-btn-outline"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setRejectModal({ isOpen: false, id: "", reason: "" });
                }}
              >
                Cancel
              </button>
              <button
                className="rt-btn-confirm-reject"
                disabled={!rejectModal.reason.trim()}
                onClick={(e) => {
                  e.currentTarget.blur();
                  actions.rejectRequest(rejectModal.id, rejectModal.reason);
                  setRejectModal({ isOpen: false, id: "", reason: "" });
                }}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
