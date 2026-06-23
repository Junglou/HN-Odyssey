import { useState, useRef } from "react";
import "./BannerManagement.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import {
  SearchIcon,
  ChevronDownSmallIcon,
  EyeIcon,
  EditIcon,
  MoreHorizontalIcon,
} from "../../../../assets/icons/BannerManagementIcons";
import type {
  BannerRecord,
  BannerStatus,
  BannerPosition,
} from "../../../../hooks/portal/Communication/BannerManagement/useBannerManagement";

interface BannerManagementProps {
  data: BannerRecord[];
  selectedIds: string[];
  search: string;
  statusFilter: BannerStatus | "All";
  positionFilter: BannerPosition | "All";
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalFiltered: number;
    startIndex: number;
  };
  actions: {
    changeSearch: (val: string) => void;
    changeStatusFilter: (status: BannerStatus | "All") => void;
    changePositionFilter: (position: BannerPosition | "All") => void;
    clearFilters: () => void;
    changePage: (page: number) => void;
    changeLimit: (limit: number) => void;
    toggleSelection: (id: string) => void;
    toggleSelectAll: () => void;
    openCreateDrawer: () => void;
    openEditDrawer: (record: BannerRecord) => void;
    openViewDrawer: (record: BannerRecord) => void;
    toggleBannerStatus: (id: string) => void;
    bulkActivate: () => void;
    bulkDeactivate: () => void;
    requestDelete: (id: string) => void;
    requestBulkDelete: () => void;
  };
}

export default function BannerManagement({
  data,
  selectedIds,
  search,
  statusFilter,
  positionFilter,
  pagination,
  actions,
}: BannerManagementProps) {
  // quản lý trạng thái mở rộng của bộ lọc
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [hasStatusOpened, setHasStatusOpened] = useState(false);
  const [isPositionOpen, setIsPositionOpen] = useState(false);
  const [hasPositionOpened, setHasPositionOpened] = useState(false);
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const [hasLimitOpened, setHasLimitOpened] = useState(false);

  const [openActionId, setOpenActionId] = useState<string | null>(null);

  // clickoutside
  const statusRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<HTMLDivElement>(null);
  const limitRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(statusRef, () => setIsStatusOpen(false));
  useClickOutside(positionRef, () => setIsPositionOpen(false));
  useClickOutside(limitRef, () => setIsLimitOpen(false));
  useClickOutside(actionMenuRef, () => setOpenActionId(null));

  // kiểm tra trạng thái checkbox của bảng
  const isAllSelected =
    data.length > 0 && data.every((r) => selectedIds.includes(r.id));
  const isPartiallySelected =
    data.some((r) => selectedIds.includes(r.id)) && !isAllSelected;
  const todayDate = new Date().toISOString().split("T")[0];
  const renderStatus = (status: BannerStatus, isExpired: boolean) => {
    let statusClass = "";
    let displayText = status;

    if (isExpired) {
      statusClass = "inactive";
      displayText = "Inactive";
    } else if (status === "Active") {
      statusClass = "active";
    } else if (status === "Inactive") {
      statusClass = "inactive";
    } else {
      statusClass = "pending";
    }

    return (
      <div style={{ display: "flex", alignItems: "center" }}>
        <span className={`bm-status-dot ${statusClass}`}></span>
        <span className={`bm-status-text ${statusClass}`}>{displayText}</span>
      </div>
    );
  };

  return (
    <div className="bm-container">
      <div className="bm-header">
        <div>
          <h1 className="bm-title">Banner Management</h1>
          <p className="bm-breadcrumb">
            Communication Management / Banner Management
          </p>
        </div>
        <button
          type="button"
          className="bm-btn-add"
          onClick={actions.openCreateDrawer}
        >
          Add New Banner
        </button>
      </div>

      <div className="bm-filters-card">
        <div className="bm-toolbar">
          <div className="bm-filters-row">
            <div className="bm-search-wrapper">
              <SearchIcon />
              <input
                type="text"
                className="bm-filter-input"
                placeholder="Search by banner name"
                value={search}
                onChange={(e) => actions.changeSearch(e.target.value)}
              />
            </div>

            <div className="bm-custom-dropdown" ref={statusRef}>
              <div
                className={`bm-dropdown-trigger ${isStatusOpen ? "active" : ""}`}
                onClick={() => {
                  setIsStatusOpen(!isStatusOpen);
                  if (!hasStatusOpened) setHasStatusOpened(true);
                }}
              >
                <span>{statusFilter === "All" ? "Status" : statusFilter}</span>
                <ChevronDownSmallIcon
                  className={isStatusOpen ? "rotated" : ""}
                />
              </div>
              <div
                className={`bm-dropdown-options ${isStatusOpen ? "open" : hasStatusOpened ? "closed" : ""}`}
              >
                {(["All", "Active", "Inactive", "Pending"] as const).map(
                  (opt) => (
                    <div
                      key={opt}
                      className={`bm-dropdown-option ${statusFilter === opt ? "active" : ""}`}
                      onClick={() => {
                        actions.changeStatusFilter(opt);
                        setIsStatusOpen(false);
                      }}
                    >
                      {opt}
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="bm-custom-dropdown" ref={positionRef}>
              <div
                className={`bm-dropdown-trigger ${isPositionOpen ? "active" : ""}`}
                onClick={() => {
                  setIsPositionOpen(!isPositionOpen);
                  if (!hasPositionOpened) setHasPositionOpened(true);
                }}
              >
                <span>
                  {positionFilter === "All" ? "Position" : positionFilter}
                </span>
                <ChevronDownSmallIcon
                  className={isPositionOpen ? "rotated" : ""}
                />
              </div>
              <div
                className={`bm-dropdown-options ${isPositionOpen ? "open" : hasPositionOpened ? "closed" : ""}`}
              >
                {(
                  [
                    "All",
                    "Homepage Slider",
                    "Category",
                    "Promotion",
                    "hero_banner",
                    "category_showcase",
                  ] as const
                ).map((opt) => (
                  <div
                    key={opt}
                    className={`bm-dropdown-option ${positionFilter === opt ? "active" : ""}`}
                    onClick={() => {
                      actions.changePositionFilter(opt);
                      setIsPositionOpen(false);
                    }}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="bm-btn-clear"
              onClick={actions.clearFilters}
            >
              Clear Filter
            </button>

            <div className="bm-bulk-actions">
              <button
                type="button"
                className="bm-btn-bulk"
                onClick={actions.bulkActivate}
                disabled={selectedIds.length === 0}
              >
                Bulk Activate
              </button>
              <button
                type="button"
                className="bm-btn-bulk"
                onClick={actions.bulkDeactivate}
                disabled={selectedIds.length === 0}
              >
                Bulk Deactivate
              </button>
              <button
                type="button"
                className="bm-btn-bulk danger"
                onClick={actions.requestBulkDelete}
                disabled={selectedIds.length === 0}
              >
                Bulk Delete
              </button>
            </div>
          </div>
        </div>

        <div className="bm-table-wrapper">
          <table className="bm-table">
            <thead>
              <tr>
                <th style={{ width: "4%" }}>
                  <input
                    type="checkbox"
                    className="bm-checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isPartiallySelected;
                    }}
                    onChange={actions.toggleSelectAll}
                  />
                </th>
                <th style={{ width: "24%" }}>Banner Name</th>
                <th style={{ width: "15%" }}>Display Position</th>
                <th style={{ width: "17%" }}>Display Time</th>
                <th style={{ width: "12%" }}>Status</th>
                <th style={{ width: "13%" }}>Created By</th>
                <th style={{ width: "15%" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((record) => {
                  // xác định tình trạng thời gian
                  const isPending =
                    record.startDate && record.startDate > todayDate;
                  const isExpired =
                    record.endDate && record.endDate < todayDate;
                  const isToggleDisabled = isPending || isExpired;

                  return (
                    <tr
                      key={record.id}
                      className={
                        selectedIds.includes(record.id) ? "bm-selected-row" : ""
                      }
                    >
                      <td data-label="Select Banner">
                        <input
                          type="checkbox"
                          className="bm-checkbox"
                          checked={selectedIds.includes(record.id)}
                          onChange={() => actions.toggleSelection(record.id)}
                        />
                      </td>
                      <td data-label="Banner Name">
                        <div className="bm-name-cell">
                          <img
                            src={record.imageDesktopUrl}
                            alt={record.name}
                            className="bm-name-thumbnail"
                          />
                          <span className="bm-text-strong">{record.name}</span>
                        </div>
                      </td>
                      <td data-label="Display Position">{record.position}</td>
                      <td data-label="Display Time">
                        {record.endDate ? (
                          <div className="bm-time-cell">
                            <span>{record.startDate} -</span>
                            <span>{record.endDate}</span>
                          </div>
                        ) : (
                          <span>On Going</span>
                        )}
                      </td>
                      <td data-label="Status">
                        {renderStatus(record.status, !!isExpired)}
                      </td>
                      <td data-label="Created By">{record.createdBy}</td>
                      <td data-label="Actions">
                        <div className="bm-row-actions">
                          <button
                            type="button"
                            className="bm-icon-btn"
                            onClick={() => actions.openViewDrawer(record)}
                            title="View"
                          >
                            <EyeIcon />
                          </button>
                          <button
                            type="button"
                            className="bm-icon-btn"
                            onClick={() => actions.openEditDrawer(record)}
                            title="Edit"
                          >
                            <EditIcon />
                          </button>
                          <div className="bm-toggle-cell">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={record.status === "Active"}
                              className={`bm-table-toggle ${record.status === "Active" ? "on" : ""} ${isToggleDisabled ? "disabled" : ""}`}
                              onClick={() => {
                                if (!isToggleDisabled)
                                  actions.toggleBannerStatus(record.id);
                              }}
                              disabled={!!isToggleDisabled}
                              title={
                                isPending
                                  ? "Chờ đến ngày bắt đầu"
                                  : isExpired
                                    ? "Banner đã hết hạn"
                                    : "Bật/Tắt trạng thái"
                              }
                            ></button>
                          </div>

                          <div
                            className={`bm-action-dropdown-wrapper ${openActionId === record.id ? "is-open" : ""}`}
                            ref={
                              openActionId === record.id ? actionMenuRef : null
                            }
                          >
                            <button
                              type="button"
                              className="bm-icon-btn"
                              aria-label="More actions"
                              aria-expanded={openActionId === record.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionId(
                                  openActionId === record.id ? null : record.id,
                                );
                              }}
                            >
                              <MoreHorizontalIcon />
                            </button>

                            {openActionId === record.id && (
                              <div
                                className="bm-action-dropdown-menu"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="bm-action-dropdown-item bm-item-delete"
                                  onClick={() => {
                                    actions.requestDelete(record.id);
                                    setOpenActionId(null);
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="bm-empty-state">
                    No banners found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bm-pagination">
          <span className="bm-pagination-info">
            Showing{" "}
            {pagination.totalFiltered === 0 ? 0 : pagination.startIndex + 1} to{" "}
            {Math.min(
              pagination.startIndex + pagination.limit,
              pagination.totalFiltered,
            )}{" "}
            of {pagination.totalFiltered} banners
          </span>
          <div className="bm-page-numbers">
            <button
              className="bm-page-num"
              disabled={pagination.page === 1}
              onClick={() => actions.changePage(pagination.page - 1)}
            >
              &lt;
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (num) => (
                <button
                  key={num}
                  className={`bm-page-num ${pagination.page === num ? "active" : ""}`}
                  onClick={() => actions.changePage(num)}
                >
                  {num}
                </button>
              ),
            )}
            <button
              className="bm-page-num"
              disabled={
                pagination.page === pagination.totalPages ||
                pagination.totalPages === 0
              }
              onClick={() => actions.changePage(pagination.page + 1)}
            >
              &gt;
            </button>

            {/* pagination */}
            <div className="bm-limit-dropdown" ref={limitRef}>
              <div
                className={`bm-limit-trigger ${isLimitOpen ? "active" : ""}`}
                onClick={() => {
                  setIsLimitOpen(!isLimitOpen);
                  if (!hasLimitOpened) setHasLimitOpened(true);
                }}
              >
                <span>{pagination.limit} / page</span>
                <ChevronDownSmallIcon
                  className={isLimitOpen ? "rotated" : ""}
                />
              </div>
              <div
                className={`bm-limit-options ${isLimitOpen ? "open" : hasLimitOpened ? "closed" : ""}`}
              >
                {[10, 20, 50].map((val) => (
                  <div
                    key={val}
                    className={`bm-limit-option ${pagination.limit === val ? "active" : ""}`}
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
