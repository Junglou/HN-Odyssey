import { Fragment, useRef, useState } from "react";
import "./AuditLogsTab.css";
import { ChevronDownIcon } from "../../../assets/icons/SystemIcons";
import { useClickOutside } from "../../../hooks/common/useClickOutside";
import {
  useAuditLogs,
  type AuditStatusFilter,
} from "../../../hooks/portal/System/useAuditLogs";

interface AuditLogsTabProps {
  canExport: boolean;
}

interface DropdownOption {
  value: string;
  label: string;
}

const STATUS_OPTIONS: DropdownOption[] = [
  { value: "All", label: "All Status" },
  { value: "Success", label: "Success" },
  { value: "Failed", label: "Failed" },
];

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

// Dropdown cùng kiểu với các trang Portal khác (Banner, Coupon...)
function AuditDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setIsOpen(false));

  const selected = options.find((opt) => opt.value === value) ?? options[0];

  return (
    <div className="sal-dropdown" ref={ref}>
      <div
        className={`sal-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        <span>{selected?.label}</span>
        <span className={`sal-dropdown-arrow ${isOpen ? "open" : ""}`}>
          <ChevronDownIcon />
        </span>
      </div>
      <div
        className={`sal-dropdown-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
        {options.map((opt) => (
          <div
            key={opt.value || "all"}
            className={`sal-dropdown-option ${opt.value === value ? "active" : ""}`}
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

export default function AuditLogsTab({ canExport }: AuditLogsTabProps) {
  const {
    records,
    filters,
    views,
    pagination,
    isLoading,
    isExporting,
    actions,
  } = useAuditLogs(canExport);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const departmentOptions: DropdownOption[] = [
    { value: "", label: "All Departments" },
    ...views.map((v) => ({ value: v.department, label: v.label })),
  ];

  const from = pagination.total === 0 ? 0 : pagination.startIndex + 1;
  const to = Math.min(
    pagination.startIndex + pagination.pageSize,
    pagination.total,
  );

  return (
    <div className="sys-card sal-container">
      <div className="sal-header">
        <h3 className="sys-card-title sys-mb-0">Audit Logs</h3>
        {canExport && (
          <button
            type="button"
            className="sal-btn primary"
            onClick={() => void actions.exportExcel()}
            disabled={isExporting}
          >
            {isExporting ? "Exporting..." : "Export Excel"}
          </button>
        )}
      </div>

      <div className="sal-filters">
        <input
          className="sal-input"
          placeholder="Actor email"
          value={filters.actorEmail}
          onChange={(e) => actions.changeFilter("actorEmail", e.target.value)}
        />
        <input
          className="sal-input"
          placeholder="Action (VD: LOGIN_FAILED)"
          value={filters.action}
          onChange={(e) => actions.changeFilter("action", e.target.value)}
        />
        <AuditDropdown
          value={filters.department}
          options={departmentOptions}
          onChange={(val) => actions.changeFilter("department", val)}
        />
        <AuditDropdown
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(val) =>
            actions.changeFilter("status", val as AuditStatusFilter)
          }
        />
        <input
          type="date"
          className="sal-input"
          value={filters.fromDate}
          max={filters.toDate || undefined}
          onChange={(e) => actions.changeFilter("fromDate", e.target.value)}
        />
        <input
          type="date"
          className="sal-input"
          value={filters.toDate}
          min={filters.fromDate || undefined}
          onChange={(e) => actions.changeFilter("toDate", e.target.value)}
        />
        <button
          type="button"
          className="sal-btn"
          onClick={actions.clearFilters}
        >
          Clear Filter
        </button>
      </div>

      <div className="sal-table-wrapper">
        <table className="sal-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Collection</th>
              <th>Department</th>
              <th>Status</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && records.length === 0 ? (
              <tr>
                <td colSpan={7} className="sal-empty">
                  Loading logs......
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={7} className="sal-empty">
                  No logs matching the filter.
                </td>
              </tr>
            ) : (
              records.map((log) => {
                const isExpanded = expandedId === log.id;
                return (
                  <Fragment key={log.id}>
                    <tr
                      className={`sal-row ${isExpanded ? "expanded" : ""}`}
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      title="Bấm để xem chi tiết"
                    >
                      <td>{formatDateTime(log.time)}</td>
                      <td>
                        <div className="sal-actor-email">{log.actorEmail}</div>
                        {log.actorCode && (
                          <div className="sal-actor-sub">{log.actorCode}</div>
                        )}
                      </td>
                      <td className="sal-action">{log.action}</td>
                      <td>{log.collection}</td>
                      <td>{log.department}</td>
                      <td>
                        <span
                          className={`sal-badge ${log.isSuccess ? "success" : "failed"}`}
                        >
                          {log.isSuccess ? "Success" : "Failed"}
                        </span>
                      </td>
                      <td className="sal-mono">{log.ip}</td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="sal-detail-cell">
                          <div className="sal-detail-grid">
                            <span className="sal-detail-label">Actor name</span>
                            <span>{log.actorName}</span>
                            {log.errorReason && (
                              <>
                                <span className="sal-detail-label">Error</span>
                                <span className="sal-error-text">
                                  {log.errorReason}
                                </span>
                              </>
                            )}
                            <span className="sal-detail-label">User agent</span>
                            <span className="sal-break">{log.userAgent}</span>
                            <span className="sal-detail-label">Detail</span>
                            <pre className="sal-detail-pre">
                              {log.detail
                                ? JSON.stringify(log.detail, null, 2)
                                : "—"}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="sal-pagination">
        <span>
          Showing {from} to {to} of {pagination.total} logs
        </span>
        <div className="sal-page-controls">
          <button
            type="button"
            className="sal-btn"
            disabled={pagination.page <= 1 || isLoading}
            onClick={() => actions.changePage(pagination.page - 1)}
          >
            &lt; Prev
          </button>
          <span>
            Page {pagination.totalPages === 0 ? 0 : pagination.page} /{" "}
            {pagination.totalPages}
          </span>
          <button
            type="button"
            className="sal-btn"
            disabled={pagination.page >= pagination.totalPages || isLoading}
            onClick={() => actions.changePage(pagination.page + 1)}
          >
            Next &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
