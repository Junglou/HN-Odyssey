import { useState, useRef, useEffect } from "react";
import "./TradeInManagement.css";
import TableSkeleton from "../../common/TableSkeleton/TableSkeleton";
import PortalPagination from "../../common/Pagination/PortalPagination";
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
  { value: "Cancelled", label: "Cancelled" },
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
  const [hasOpened, setHasOpened] = useState(false);
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
        onClick={() => {
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        <span>{selectedOption.label}</span>
        <div className={`tim-dropdown-arrow ${isOpen ? "open" : ""}`}>
          <ChevronDownSmallIcon />
        </div>
      </div>

      <div
        className={`tim-dropdown-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
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
    </div>
  );
}

// props
interface TradeInManagementProps {
  data: TradeInRow[];
  isLoading?: boolean;
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
    openApproveModal: (id: string) => void;
    openRejectModal: (id: string) => void;
    receiveItem: (id: string) => void;
    createOrder: (id: string) => void;
    openFinalizeModal: (id: string) => void;
    exportExcel: () => void;
    printInvoice: (selectedIds?: string[]) => void;
    printDeliverySlip: (selectedIds?: string[]) => void;
    refreshData: () => void;
    markShippingAsReceived: (id: string) => void; // Thêm hàm này
  };
}

// component
export default function TradeInManagement({
  data,
  isLoading = false,
  filters,
  pagination,
  actions,
}: TradeInManagementProps) {
  // states

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prevData, setPrevData] = useState<TradeInRow[]>(data);

  // logic: reset Data
  if (data !== prevData) {
    setPrevData(data);
    setSelectedIds([]);
  }

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
            <tbody
              className={`portal-tbody ${isLoading && data.length > 0 ? "is-refreshing" : ""}`}
            >
              {isLoading && data.length === 0 ? (
                <TableSkeleton columns={9} />
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="portal-empty-state">
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
                                actions.openApproveModal(row.id);
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
                          <>
                            {row.evaluationMethod === "SHIPPING" && (
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

                            {row.evaluationMethod === "VISIT_STORE" && (
                              <button
                                type="button"
                                className="tim-btn-outline-primary"
                                onClick={(e) => {
                                  actions.receiveItem(row.id);
                                  e.currentTarget.blur();
                                }}
                              >
                                Receive at Store
                              </button>
                            )}
                          </>
                        )}

                        {/* HÀM MỚI: Bổ sung nút bấm dành riêng cho đơn đang Shipping ở môi trường Sandbox */}
                        {row.status === "Shipping" && (
                          <button
                            type="button"
                            className="tim-btn-outline-primary"
                            title="Mock Sandbox Webhook"
                            onClick={(e) => {
                              actions.markShippingAsReceived(row.id);
                              e.currentTarget.blur();
                            }}
                          >
                            Manual Receive
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
        <PortalPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          onPageChange={actions.changePage}
          onPageSizeChange={actions.changeLimit}
          itemLabel="requests"
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
