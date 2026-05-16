import React, { useState, useRef, useEffect } from "react";
import { useStockTickets } from "../../../../hooks/portal/Warehouse/useStockTickets";
import { ChevronDownIcon } from "../../../../assets/icons/HeaderIcons";
import ExcelJS from "exceljs";
import {
  ExpandRowIcon,
  RefreshIcon,
  PrintIcon,
} from "../../../../assets/icons/StockManagementIcons";
import "./StockTicketsTab.css";

// options
const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "import", label: "Import" },
  { value: "export", label: "Export" },
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
    <div className={`stt-custom-dropdown ${className}`} ref={dropdownRef}>
      <div
        className={`stt-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        <span>{selectedLabel}</span>
        <ChevronDownIcon
          className={`stt-dropdown-arrow ${isOpen ? "open" : ""}`}
        />
      </div>

      <div
        className={`stt-dropdown-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`stt-dropdown-option ${value === opt.value ? "selected" : ""}`}
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
interface StockTicketsTabProps {
  data: ReturnType<typeof useStockTickets>["data"];
  filters: ReturnType<typeof useStockTickets>["filters"];
  pagination: ReturnType<typeof useStockTickets>["pagination"];
  actions: ReturnType<typeof useStockTickets>["actions"];
}

interface TicketItem {
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
}

interface TicketData {
  ticketCode: string;
  type: string;
  status: string;
  createdAt: string | Date;
  items: TicketItem[];
}

export default function StockTicketsTab({
  data,
  filters,
  pagination,
  actions,
}: StockTicketsTabProps) {
  // states
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [closingRows, setClosingRows] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const [hasLimitOpened, setHasLimitOpened] = useState(false);
  const limitRef = useRef<HTMLDivElement>(null);

  const [completeModal, setCompleteModal] = useState<{
    isOpen: boolean;
    ticketId: string;
  }>({ isOpen: false, ticketId: "" });
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    ticketId: string;
    reason: string;
  }>({ isOpen: false, ticketId: "", reason: "" });

  // hooks
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
  const toggleRow = (id: string) => {
    if (expandedRows.has(id)) {
      setClosingRows((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setExpandedRows((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        setClosingRows((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }, 250);
    } else {
      setExpandedRows((prev) => new Set(prev).add(id));
    }
  };
  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    actions.refreshData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // helpers
  const renderStatus = (status: string) => {
    if (status === "completed") {
      return (
        <span className="stt-status stt-status-done">
          <span className="stt-dot"></span> Completed
        </span>
      );
    } else if (status === "processing") {
      return (
        <span className="stt-status stt-status-processing">
          <span className="stt-dot"></span> Processing
        </span>
      );
    } else {
      return (
        <span className="stt-status stt-status-cancel">
          <span className="stt-dot"></span> Cancelled
        </span>
      );
    }
  };
  const handleExportExcel = async (ticket: TicketData) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Ticket Detail");

    worksheet.mergeCells("A1:D1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "WAREHOUSE TICKET DETAIL";
    titleCell.font = { size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF10B981" },
    };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };

    worksheet.addRow(["Ticket Code:", ticket.ticketCode]);
    worksheet.addRow(["Type:", ticket.type.toUpperCase()]);
    worksheet.addRow(["Status:", ticket.status.toUpperCase()]);
    worksheet.addRow(["Date:", new Date(ticket.createdAt).toLocaleString()]);
    worksheet.addRow([]);

    const headerRow = worksheet.addRow([
      "SKU",
      "Product Name",
      "Quantity",
      "Unit",
    ]);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    ticket.items.forEach((item: TicketItem) => {
      const row = worksheet.addRow([
        item.sku,
        item.productName,
        item.quantity,
        item.unit,
      ]);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    worksheet.columns = [
      { width: 15 },
      { width: 40 },
      { width: 15 },
      { width: 10 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ticket.ticketCode}_Export.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // main render
  return (
    <div className="stt-container">
      {/* filters row */}
      <div className="stt-filters-row">
        <input
          type="text"
          className="stt-filter-input"
          placeholder="Search Ticket Code..."
          value={filters.search}
          onChange={(e) => actions.changeFilter("search", e.target.value)}
        />
        <CustomDropdown
          value={filters.type}
          options={TYPE_OPTIONS}
          onChange={(val) =>
            actions.changeFilter("type", val as "all" | "import" | "export")
          }
          className="stt-filter-dropdown"
        />
        <button
          type="button"
          className="stt-btn-clear"
          onClick={(e) => {
            actions.clearFilter();
            e.currentTarget.blur();
          }}
        >
          Clear Filters
        </button>
        <button
          type="button"
          className="stt-btn-refresh"
          onClick={(e) => {
            handleRefresh();
            e.currentTarget.blur();
          }}
        >
          <span
            className={isRefreshing ? "spin-icon-active" : ""}
            style={{ display: "flex" }}
          >
            <RefreshIcon />
          </span>
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* table wrapper */}
      <div className="stt-table-wrapper">
        <table className="stt-table">
          <thead>
            <tr>
              <th className="stt-col-expand" style={{ width: "5%" }}></th>
              <th style={{ width: "20%" }}>Ticket Code</th>
              <th style={{ width: "10%", textAlign: "center" }}>Type</th>
              <th style={{ width: "15%" }}>Created Date</th>
              <th style={{ width: "15%" }}>Created By</th>
              <th style={{ width: "10%", textAlign: "center" }}>Total Qty</th>
              <th style={{ width: "10%", textAlign: "center" }}>Status</th>
              <th style={{ width: "15%", textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={8} className="stt-td-empty">
                  No tickets found
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <React.Fragment key={item.id}>
                  {/* main row */}
                  <tr className="stt-row-main">
                    <td className="stt-col-expand">
                      {item.items && item.items.length > 0 && (
                        <button
                          className="stt-expand-btn"
                          onClick={(e) => {
                            toggleRow(item.id);
                            e.currentTarget.blur();
                          }}
                        >
                          <ExpandRowIcon isOpen={expandedRows.has(item.id)} />
                        </button>
                      )}
                    </td>
                    <td className="stt-font-mono" style={{ fontWeight: 600 }}>
                      {item.ticketCode}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`stt-type-badge stt-type-${item.type}`}>
                        {item.type}
                      </span>
                    </td>
                    <td>{new Date(item.createdDate).toLocaleString()}</td>
                    <td>{item.createdBy}</td>
                    <td
                      className="stt-font-nums"
                      style={{ textAlign: "center", fontWeight: 600 }}
                    >
                      {item.totalQuantity}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {renderStatus(item.status)}
                    </td>
                    {/* Actions */}
                    <td style={{ textAlign: "center" }}>
                      <div className="stt-actions-group">
                        <button
                          className="stt-action-btn stt-btn-print"
                          title="Print PDF"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.currentTarget.blur();
                            alert("Tính năng in PDF sẽ được tích hợp sau.");
                          }}
                        >
                          <PrintIcon />
                        </button>

                        <button
                          className="stt-action-btn-text stt-action-btn-excel"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.currentTarget.blur();
                            handleExportExcel(item as unknown as TicketData);
                          }}
                          title="Export to Excel"
                        >
                          Excel
                        </button>

                        {item.status === "processing" && (
                          <>
                            <button
                              className="stt-action-btn-text stt-btn-complete-text"
                              title="Confirm Complete"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.currentTarget.blur();
                                setCompleteModal({
                                  isOpen: true,
                                  ticketId: item.id,
                                });
                              }}
                            >
                              Complete
                            </button>

                            <button
                              className="stt-action-btn-text stt-btn-cancel-text"
                              title="Cancel Ticket"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.currentTarget.blur();
                                setCancelModal({
                                  isOpen: true,
                                  ticketId: item.id,
                                  reason: "",
                                });
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* sub table */}
                  {(expandedRows.has(item.id) || closingRows.has(item.id)) &&
                    item.items && (
                      <tr className="stt-row-items">
                        <td
                          colSpan={8}
                          className={`stt-items-container ${closingRows.has(item.id) ? "closing" : ""}`}
                        >
                          <table className="stt-items-table">
                            <thead>
                              <tr>
                                <th style={{ width: "25%" }}>Item SKU</th>
                                <th style={{ width: "40%" }}>Product Name</th>
                                <th style={{ width: "15%" }}>Quantity</th>
                                <th style={{ width: "20%" }}>Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.items.map((subItem, idx) => (
                                <tr key={`${subItem.sku}-${idx}`}>
                                  <td className="stt-item-sku">
                                    {subItem.sku}
                                  </td>
                                  <td>{subItem.productName}</td>
                                  <td className="stt-item-qty">
                                    {subItem.quantity}
                                  </td>
                                  <td>{subItem.reason || "—"}</td>
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

      {/* pagination */}
      <div className="stt-pagination">
        <div>
          Showing{" "}
          {pagination.total === 0
            ? 0
            : (pagination.page - 1) * pagination.limit + 1}
          -{Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
          {pagination.total} items
        </div>

        <div className="stt-page-numbers">
          <button
            type="button"
            className="stt-page-num"
            style={{
              opacity: pagination.page === 1 ? 0.4 : 1,
              pointerEvents: pagination.page === 1 ? "none" : "auto",
            }}
            onClick={(e) => {
              actions.changePage(Math.max(pagination.page - 1, 1));
              e.currentTarget.blur();
            }}
          >
            &lt;
          </button>

          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
            (num) => (
              <button
                key={num}
                type="button"
                className={`stt-page-num ${pagination.page === num ? "active" : ""}`}
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
            className="stt-page-num"
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
              actions.changePage(
                Math.min(pagination.page + 1, pagination.totalPages),
              );
              e.currentTarget.blur();
            }}
          >
            &gt;
          </button>

          <div className="stt-limit-dropdown" ref={limitRef}>
            <div
              className={`stt-limit-trigger ${isLimitOpen ? "active" : ""}`}
              onClick={() => {
                setIsLimitOpen(!isLimitOpen);
                if (!hasLimitOpened) setHasLimitOpened(true);
              }}
            >
              <span>{pagination.limit} / page</span>
              <ChevronDownIcon
                className={`stt-limit-icon ${isLimitOpen ? "open" : ""}`}
              />
            </div>

            <div
              className={`stt-limit-options ${isLimitOpen ? "open" : hasLimitOpened ? "closed" : ""}`}
            >
              {[10, 20, 50].map((val) => (
                <div
                  key={val}
                  className={`stt-limit-option ${pagination.limit === val ? "active" : ""}`}
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

      {/* Complete Modal */}
      {completeModal.isOpen && (
        <div className="stt-modal-overlay">
          <div className="stt-modal">
            <h3 className="stt-modal-title">Confirm Completion</h3>
            <p className="stt-modal-desc">
              Are you sure you want to mark this ticket as completed? This
              action will permanently update the physical inventory and cannot
              be undone.
            </p>
            <div className="stt-modal-footer">
              <button
                className="stt-btn-outline"
                onClick={() =>
                  setCompleteModal({ isOpen: false, ticketId: "" })
                }
              >
                Go Back
              </button>
              <button
                className="stt-btn-confirm-complete"
                onClick={(e) => {
                  e.currentTarget.blur();
                  actions.completeTicket(completeModal.ticketId);
                  setCompleteModal({ isOpen: false, ticketId: "" });
                }}
              >
                Confirm Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal.isOpen && (
        <div className="stt-modal-overlay">
          <div className="stt-modal">
            <h3 className="stt-modal-title">Cancel Ticket</h3>
            <p className="stt-modal-desc">
              Please provide a reason for cancelling this ticket. This will be
              recorded in the system logs.
            </p>
            <textarea
              className="stt-modal-textarea"
              placeholder="Enter reason here (required)..."
              value={cancelModal.reason}
              onChange={(e) =>
                setCancelModal({ ...cancelModal, reason: e.target.value })
              }
              autoFocus
            />
            <div className="stt-modal-footer">
              <button
                className="stt-btn-outline"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setCancelModal({ isOpen: false, ticketId: "", reason: "" });
                }}
              >
                Close
              </button>
              <button
                className="stt-btn-confirm-cancel"
                disabled={cancelModal.reason.trim().length === 0}
                onClick={(e) => {
                  e.currentTarget.blur();
                  actions.cancelTicket(
                    cancelModal.ticketId,
                    cancelModal.reason,
                  );
                  setCancelModal({ isOpen: false, ticketId: "", reason: "" });
                }}
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
