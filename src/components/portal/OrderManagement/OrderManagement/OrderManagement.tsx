import { useState, useRef, useEffect } from "react";
import "./OrderManagement.css";
import {
  EyeIcon,
  ChevronDownSmallIcon,
  RefreshIcon,
} from "../../../../assets/icons/OrderManagementIcons";
import type {
  OrderRow,
  OrderStatus,
} from "../../../../hooks/portal/OrderManagement/OrderManagement/useOrderManagement";

// options
const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Packaging", label: "Packaging" },
  { value: "Shipping", label: "Shipping" },
  { value: "Delivered", label: "Delivered" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Refunded", label: "Refunded" },
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
  // states
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false); // Thêm state này
  const dropdownRef = useRef<HTMLDivElement>(null);

  // effects
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
    <div className={`om-custom-dropdown ${className}`} ref={dropdownRef}>
      <div
        className={`om-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        <span>{selectedOption.label}</span>
        <div className={`om-dropdown-arrow ${isOpen ? "open" : ""}`}>
          <ChevronDownSmallIcon />
        </div>
      </div>
      <div
        className={`om-dropdown-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`om-dropdown-option ${value === opt.value ? "selected" : ""}`}
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
interface OrderManagementProps {
  data: OrderRow[];
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
    openDetail: (orderId: string) => void;
    openStatusModal: (orderId: string, currentStatus: OrderStatus) => void;
    advanceOrderStatus: (orderId: string, nextStatus: OrderStatus) => void;
    exportExcel: () => void;
    printInvoice: (selectedIds?: string[]) => void;
    printDeliverySlip: (selectedIds?: string[]) => void;
    refreshData: () => void;
  };
}

// component
export default function OrderManagement({
  data,
  filters,
  pagination,
  actions,
}: OrderManagementProps) {
  // states
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const [hasLimitOpened, setHasLimitOpened] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prevData, setPrevData] = useState<OrderRow[]>(data);
  const limitRef = useRef<HTMLDivElement>(null);

  // So sánh data trong Render Phase để reset checkbox (Sạch sẽ, không dính lỗi ESLint)
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

  // main render
  return (
    <div className="om-container">
      {/* header */}
      <div className="om-header">
        <div>
          <h1 className="om-title">Order Management</h1>
          <p className="om-breadcrumb">Order Management / Order List</p>
        </div>
        <button className="om-btn-export" onClick={actions.exportExcel}>
          Export Excel
        </button>
      </div>

      {/* card */}
      <div className="om-card">
        {/* toolbar */}
        <div className="om-filters-row">
          <input
            type="text"
            className="om-filter-input"
            placeholder="Search by Order Code or Customer..."
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
            className="om-filter-input"
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
            className="om-filter-input"
            value={filters.toDate}
            onChange={(e) => actions.changeFilter("toDate", e.target.value)}
            title="To Date"
          />

          <button
            type="button"
            className="om-btn-clear"
            onClick={(e) => {
              actions.clearFilters();
              e.currentTarget.blur();
            }}
          >
            Clear Filters
          </button>

          <button
            type="button"
            className="om-btn-action-top"
            onClick={(e) => {
              handleRefresh();
              e.currentTarget.blur();
            }}
          >
            <span
              className={isRefreshing ? "om-spin-anim" : ""}
              style={{ display: "flex" }}
            >
              <RefreshIcon />
            </span>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            className="om-btn-action-top"
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
            className="om-btn-action-top"
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
            Print Slip {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
          </button>
        </div>

        {/* table */}
        <div className="om-table-container">
          <table className="om-table">
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
                <th>Order Code</th>
                <th>Order Date</th>
                <th>Customer</th>
                <th>Created By</th>
                <th>Total Amount</th>
                <th className="om-text-center">Payment</th>
                <th className="om-text-center">Status</th>
                <th className="om-text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="om-empty-state">
                    No orders found.
                  </td>
                </tr>
              ) : (
                data.map((order) => {
                  /* TODO (Backend Integration - 24h Grace Period):
                    Sau này BE sẽ trả về cờ `isEditable: boolean` cho từng dòng.
                    Cờ này được BE tính dựa trên: Nếu cập nhật thủ công < 24h thì true, ngược lại false.
                    FE lúc đó chỉ cần lấy: const canUpdate = order.isEditable;
                  */
                  const isTerminal = [
                    "Delivered",
                    "Cancelled",
                    "Refunded",
                  ].includes(order.orderStatus);
                  const canUpdate =
                    order.orderStatus !== "Pending" && !isTerminal;

                  return (
                    <tr
                      key={order.id}
                      className={
                        selectedIds.includes(order.id) ? "om-row-selected" : ""
                      }
                    >
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(order.id)}
                          onChange={() => handleSelectRow(order.id)}
                          style={{ cursor: "pointer" }}
                        />
                      </td>
                      <td className="om-font-semibold">{order.orderCode}</td>
                      <td>{new Date(order.orderDate).toLocaleDateString()}</td>
                      <td>{order.customerName}</td>
                      <td>{order.createdBy}</td>
                      <td className="om-text-blue-bold">
                        ${order.totalAmount.toLocaleString()}
                      </td>
                      <td className="om-text-center">
                        <span
                          className={`om-badge om-badge-payment-${order.paymentStatus}`}
                        >
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="om-text-center">
                        <span
                          className={`om-badge om-badge-status-${order.orderStatus}`}
                        >
                          {order.orderStatus}
                        </span>
                      </td>
                      <td>
                        <div className="om-row-actions">
                          <button
                            type="button"
                            className="om-icon-btn"
                            title="View Details"
                            onClick={(e) => {
                              actions.openDetail(order.id);
                              e.currentTarget.blur();
                            }}
                          >
                            <EyeIcon />
                          </button>

                          {order.orderStatus === "Pending" && (
                            <button
                              type="button"
                              className="om-btn-outline-primary"
                              onClick={(e) => {
                                actions.advanceOrderStatus(
                                  order.id,
                                  "Confirmed",
                                );
                                e.currentTarget.blur();
                              }}
                            >
                              Confirm
                            </button>
                          )}

                          {order.orderStatus === "Confirmed" && (
                            <button
                              type="button"
                              className="om-btn-outline-primary"
                              onClick={(e) => {
                                actions.advanceOrderStatus(
                                  order.id,
                                  "Packaging",
                                );
                                e.currentTarget.blur();
                              }}
                            >
                              Process
                            </button>
                          )}

                          {canUpdate && (
                            <button
                              type="button"
                              className="om-btn-outline-primary"
                              onClick={(e) => {
                                actions.openStatusModal(
                                  order.id,
                                  order.orderStatus,
                                );
                                e.currentTarget.blur();
                              }}
                            >
                              Update Status
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div className="om-pagination">
          <span>
            Showing {pagination.startIndex} - {pagination.endIndex} of{" "}
            {pagination.total} records
          </span>

          <div className="om-page-controls">
            <button
              type="button"
              className="om-btn-page"
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
                  className={`om-btn-page ${pagination.page === num ? "active" : ""}`}
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
              className="om-btn-page"
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

            <div className="om-limit-dropdown" ref={limitRef}>
              <div
                className={`om-limit-trigger ${isLimitOpen ? "active" : ""}`}
                onClick={() => {
                  setIsLimitOpen(!isLimitOpen);
                  if (!hasLimitOpened) setHasLimitOpened(true);
                }}
              >
                <span>{pagination.limit} / page</span>
                <div className={`om-limit-icon ${isLimitOpen ? "open" : ""}`}>
                  <ChevronDownSmallIcon />
                </div>
              </div>

              <div
                className={`om-limit-options ${isLimitOpen ? "open" : hasLimitOpened ? "closed" : ""}`}
              >
                {[10, 20, 50].map((val) => (
                  <div
                    key={val}
                    className={`om-limit-option ${pagination.limit === val ? "active" : ""}`}
                    onClick={() => {
                      actions.changeLimit(val);
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
      </div>
    </div>
  );
}
