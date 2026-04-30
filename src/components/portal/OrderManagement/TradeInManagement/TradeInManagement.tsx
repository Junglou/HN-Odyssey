import { useState, useRef, useEffect } from "react";
import "./TradeInManagement.css";
import {
  ChevronDownSmallIcon,
  RefreshIcon,
} from "../../../../assets/icons/OrderManagementIcons";
import type { TradeInRow } from "../../../../hooks/portal/OrderManagement/TradeInManagement/useTradeInManagement";

// options
const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Shipping", label: "Shipping" },
  { value: "Received", label: "Received" },
  { value: "Completed", label: "Completed" },
  { value: "Rejected", label: "Rejected" },
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

  const selectedOption =
    options.find((opt) => opt.value === value) || options[0];

  return (
    <div className={`tim-custom-dropdown ${className}`} ref={dropdownRef}>
      <div
        className={`tim-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption.label}</span>
        <div className={`tim-dropdown-arrow ${isOpen ? "open" : ""}`}>
          <ChevronDownSmallIcon />
        </div>
      </div>
      {isOpen && (
        <div className="tim-dropdown-options">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`tim-dropdown-option ${value === opt.value ? "selected" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// props
interface TradeInManagementProps {
  data: TradeInRow[];
  filters: {
    search: string;
    status: string;
    fromDate: string;
    toDate: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    startIndex: number;
    endIndex: number;
  };
  actions: {
    changeFilter: (
      key: "search" | "status" | "fromDate" | "toDate",
      val: string,
    ) => void;
    clearFilters: () => void;
    changePage: (page: number) => void;
    changeLimit: (limit: number) => void;
    openDetail: (id: string) => void;
    approveTradeIn: (id: string) => void;
    openRejectModal: (id: string) => void;
    createOrder: (id: string) => void;
    simulateScanReceive: (id: string) => void; // Hàm giả lập
    openFinalizeModal: (id: string) => void;
    exportExcel: () => void;
    printInvoice: (selectedIds?: string[]) => void;
    printDeliverySlip: (selectedIds?: string[]) => void;
    refreshData: () => void;
  };
}

// component
export default function TradeInManagement({
  data,
  filters,
  pagination,
  actions,
}: TradeInManagementProps) {
  // states
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prevData, setPrevData] = useState<TradeInRow[]>(data);
  const limitRef = useRef<HTMLDivElement>(null);

  // logic: reset Data
  if (data !== prevData) {
    setPrevData(data);
    setSelectedIds([]);
  }

  // effects
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

  // handlers
  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    actions.refreshData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const isAllSelected = data.length > 0 && selectedIds.length === data.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.map((item) => item.id));
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id],
    );
  };

  return (
    <div className="tim-container">
      {/* header */}
      <div className="tim-header">
        <div>
          <h1 className="tim-title">Trade-in Management</h1>
          <p className="tim-breadcrumb">Order Management / Trade-in</p>
        </div>
        <button className="tim-btn-export" onClick={actions.exportExcel}>
          Export Excel
        </button>
      </div>

      {/* card */}
      <div className="tim-card">
        {/* toolbar */}
        <div className="tim-filters-row">
          <input
            type="text"
            className="tim-filter-input"
            placeholder="Search by Name, Email, Phone..."
            value={filters.search}
            onChange={(e) => actions.changeFilter("search", e.target.value)}
          />

          <CustomDropdown
            value={filters.status}
            options={STATUS_OPTIONS}
            onChange={(val) => actions.changeFilter("status", val)}
          />

          <input
            type="date"
            className="tim-filter-input"
            value={filters.fromDate}
            onChange={(e) => actions.changeFilter("fromDate", e.target.value)}
            title="From Date"
          />

          <span
            style={{ color: "#6b7280", fontWeight: 500, alignSelf: "center" }}
          >
            -
          </span>

          <input
            type="date"
            className="tim-filter-input"
            value={filters.toDate}
            onChange={(e) => actions.changeFilter("toDate", e.target.value)}
            title="To Date"
          />

          <button
            type="button"
            className="tim-btn-clear"
            onClick={(e) => {
              actions.clearFilters();
              e.currentTarget.blur();
            }}
          >
            Clear Filter
          </button>

          <button
            type="button"
            className="tim-btn-action-top"
            onClick={(e) => {
              handleRefresh();
              e.currentTarget.blur();
            }}
          >
            <span
              className={isRefreshing ? "tim-spin-anim" : ""}
              style={{ display: "flex" }}
            >
              <RefreshIcon />
            </span>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            className="tim-btn-action-top"
            disabled={selectedIds.length === 0}
            style={
              selectedIds.length === 0
                ? { opacity: 0.5, cursor: "not-allowed" }
                : {}
            }
            onClick={(e) => {
              actions.printInvoice(selectedIds);
              e.currentTarget.blur();
            }}
          >
            Print Invoice{" "}
            {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
          </button>

          <button
            type="button"
            className="tim-btn-action-top"
            disabled={selectedIds.length === 0}
            style={
              selectedIds.length === 0
                ? { opacity: 0.5, cursor: "not-allowed" }
                : {}
            }
            onClick={(e) => {
              actions.printDeliverySlip(selectedIds);
              e.currentTarget.blur();
            }}
          >
            Print Delivery Slip{" "}
            {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
          </button>
        </div>

        {/* table */}
        <div className="tim-table-container">
          <table className="tim-table">
            <thead>
              <tr>
                <th style={{ width: "40px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    style={{ cursor: "pointer" }}
                  />
                </th>
                <th>Trade-in Code</th>
                <th>Customer</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Device</th>
                <th className="tim-text-right">Estimate Value</th>
                <th className="tim-text-center">Status</th>
                <th className="tim-text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="tim-empty-state">
                    No trade-in requests found.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      selectedIds.includes(row.id) ? "tim-row-selected" : ""
                    }
                  >
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => handleSelectRow(row.id)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    <td className="tim-font-semibold">{row.tradeInCode}</td>
                    <td>{row.customerName}</td>
                    <td>{row.email}</td>
                    <td>{row.customerPhone}</td>
                    <td>{row.device.productName}</td>
                    <td className="tim-text-blue-bold tim-text-right">
                      ${row.expectedValue.toFixed(2)}
                    </td>
                    <td className="tim-text-center">
                      <span
                        className={`tim-badge tim-badge-status-${row.status}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <div className="tim-row-actions">
                        <button
                          type="button"
                          className="tim-btn-outline-primary"
                          onClick={(e) => {
                            actions.openDetail(row.id);
                            e.currentTarget.blur();
                          }}
                        >
                          View Details
                        </button>

                        {row.status === "Pending" && (
                          <>
                            <button
                              type="button"
                              className="tim-btn-outline-primary"
                              onClick={(e) => {
                                actions.approveTradeIn(row.id);
                                e.currentTarget.blur();
                              }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="tim-btn-outline-danger"
                              onClick={(e) => {
                                actions.openRejectModal(row.id);
                                e.currentTarget.blur();
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {row.status === "Approved" && (
                          <button
                            type="button"
                            className="tim-btn-outline-primary"
                            onClick={(e) => {
                              actions.createOrder(row.id);
                              e.currentTarget.blur();
                            }}
                          >
                            Create Order
                          </button>
                        )}

                        {row.status === "Shipping" && (
                          <button
                            type="button"
                            className="tim-btn-outline-primary"
                            style={{ borderStyle: "dashed" }}
                            title="Mock Scanner: Simulate warehouse receiving"
                            onClick={(e) => {
                              actions.simulateScanReceive(row.id);
                              e.currentTarget.blur();
                            }}
                          >
                            [Mock Scan]
                          </button>
                        )}

                        {row.status === "Received" && (
                          <button
                            type="button"
                            className="tim-btn-outline-primary"
                            onClick={(e) => {
                              actions.openFinalizeModal(row.id);
                              e.currentTarget.blur();
                            }}
                          >
                            Finalize Value
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div className="tim-pagination">
          <span>
            Showing {pagination.startIndex} - {pagination.endIndex} of{" "}
            {pagination.total} records
          </span>

          <div className="tim-page-controls">
            <button
              type="button"
              className="tim-btn-page"
              disabled={pagination.page === 1}
              onClick={(e) => {
                actions.changePage(Math.max(1, pagination.page - 1));
                e.currentTarget.blur();
              }}
            >
              &lt;
            </button>

            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (num) => (
                <button
                  type="button"
                  key={num}
                  className={`tim-btn-page ${pagination.page === num ? "active" : ""}`}
                  onClick={(e) => {
                    actions.changePage(num);
                    e.currentTarget.blur();
                  }}
                >
                  {num}
                </button>
              ),
            )}

            <button
              type="button"
              className="tim-btn-page"
              disabled={
                pagination.page === pagination.totalPages ||
                pagination.totalPages === 0
              }
              onClick={(e) => {
                actions.changePage(
                  Math.min(pagination.totalPages, pagination.page + 1),
                );
                e.currentTarget.blur();
              }}
            >
              &gt;
            </button>

            <div className="tim-limit-dropdown" ref={limitRef}>
              <div
                className={`tim-limit-trigger ${isLimitOpen ? "active" : ""}`}
                onClick={() => setIsLimitOpen(!isLimitOpen)}
              >
                <span>{pagination.limit} / page</span>
                <div className={`tim-limit-icon ${isLimitOpen ? "open" : ""}`}>
                  <ChevronDownSmallIcon />
                </div>
              </div>
              {isLimitOpen && (
                <div className="tim-limit-options">
                  {[10, 20, 50].map((val) => (
                    <div
                      key={val}
                      className={`tim-limit-option ${pagination.limit === val ? "active" : ""}`}
                      onClick={() => {
                        actions.changeLimit(val);
                        setIsLimitOpen(false);
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
