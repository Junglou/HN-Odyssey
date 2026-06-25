import { useState, useRef } from "react";
import "./CustomerManagement.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import {
  EyeIcon,
  EditUserIcon,
  MoreHorizontalIcon,
  DefaultAvatarIcon,
  ChevronDownSmallIcon,
} from "../../../../assets/icons/CustomerManagementIcons";

import type {
  CustomerRecord,
  CustomerStatus,
  CustomerType,
} from "../../../../hooks/portal/CustomerCRM/CustomerManagement/useCustomerManagement";

interface CustomerManagementProps {
  data: CustomerRecord[];
  search: string;
  statusFilter: CustomerStatus | "All";
  typeFilter: CustomerType | "All";
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
    changeStatusFilter: (status: CustomerStatus | "All") => void;
    changeTypeFilter: (type: CustomerType | "All") => void;
    clearFilters: () => void;
    toggleSelection: (id: string) => void;
    toggleSelectAll: (isSelectAll: boolean) => void;
    openAddModal: () => void;
    openEditModal: (record: CustomerRecord) => void;
    openViewModal: (record: CustomerRecord) => void;
    openDeleteModal: (record?: CustomerRecord) => void;
    changePage: (page: number) => void;
    changeLimit: (limit: number) => void;
    lockUnlockCustomer: (id: string, currentStatus: CustomerStatus) => void;
    exportExcel: () => void;
  };
  toggleRowStatus: (id: string, currentStatus: CustomerStatus) => void;
  bulkActions: {
    bulkActivate: () => void;
    bulkDeactivate: () => void;
    bulkDelete: () => void;
  };
}

export default function CustomerManagement({
  data,
  search,
  statusFilter,
  typeFilter,
  selectedIds,
  pagination,
  actions,
  toggleRowStatus,
  bulkActions,
}: CustomerManagementProps) {
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [hasStatusOpened, setHasStatusOpened] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [hasTypeOpened, setHasTypeOpened] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const statusRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const [isLimitDropdownOpen, setIsLimitDropdownOpen] = useState(false);
  const [hasLimitOpened, setHasLimitOpened] = useState(false);
  const limitRef = useRef<HTMLDivElement>(null);

  useClickOutside(statusRef, () => setIsStatusOpen(false));
  useClickOutside(typeRef, () => setIsTypeOpen(false));
  useClickOutside(actionMenuRef, () => setOpenActionId(null));
  useClickOutside(limitRef, () => setIsLimitDropdownOpen(false));

  const isAllSelected =
    data.length > 0 && data.every((r) => selectedIds.has(r.id));
  const isPartiallySelected =
    data.some((r) => selectedIds.has(r.id)) && !isAllSelected;

  const renderStatusBadge = (status: CustomerStatus) => {
    switch (status) {
      case "Active":
        return (
          <span className="crm-badge crm-badge-active">
            <span className="crm-dot"></span> Active
          </span>
        );
      case "Inactive":
        return (
          <span className="crm-badge crm-badge-inactive">
            <span className="crm-dot"></span> Inactive
          </span>
        );
      case "Locked":
        return (
          <span className="crm-badge crm-badge-locked">
            <span className="crm-dot"></span> Locked
          </span>
        );
      case "Deleted":
        return (
          <span className="crm-badge crm-badge-deleted">
            <span className="crm-dot"></span> Deleted
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="crm-container">
      <div className="crm-header">
        <div>
          <h1 className="crm-title">Customer Management</h1>
          <p className="crm-breadcrumb">Customer CRM / Customer Management</p>
        </div>
        <div className="crm-header-actions">
          <button
            type="button"
            className="crm-btn-add crm-btn-export"
            onClick={actions.exportExcel}
          >
            Export Excel
          </button>
          <button
            type="button"
            className="crm-btn-add"
            onClick={actions.openAddModal}
          >
            + Add New User
          </button>
        </div>
      </div>

      <div className="crm-filters-card">
        <div className="crm-toolbar">
          <div className="crm-filters-row">
            <input
              type="search"
              autoComplete="new-password"
              name="crmSearchBoxUser"
              className="crm-filter-input"
              placeholder="Search by name, email or username"
              value={search}
              onChange={(e) => actions.changeSearch(e.target.value)}
            />

            <div className="crm-custom-dropdown" ref={statusRef}>
              <div
                className="crm-dropdown-trigger"
                onClick={() => {
                  setIsStatusOpen(!isStatusOpen);
                  if (!hasStatusOpened) setHasStatusOpened(true);
                }}
              >
                <span>{statusFilter === "All" ? "Status" : statusFilter}</span>
                <ChevronDownSmallIcon
                  className={`crm-dropdown-arrow ${isStatusOpen ? "open" : ""}`}
                />
              </div>
              <div
                className={`crm-dropdown-options ${isStatusOpen ? "open" : hasStatusOpened ? "closed" : ""}`}
              >
                {(
                  ["All", "Active", "Inactive", "Locked", "Deleted"] as const
                ).map((opt) => (
                  <div
                    key={opt}
                    className={`crm-dropdown-option ${statusFilter === opt ? "active" : ""}`}
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

            <div className="crm-custom-dropdown" ref={typeRef}>
              <div
                className="crm-dropdown-trigger"
                onClick={() => {
                  setIsTypeOpen(!isTypeOpen);
                  if (!hasTypeOpened) setHasTypeOpened(true);
                }}
              >
                <span>
                  {typeFilter === "All" ? "Customer Type" : typeFilter}
                </span>
                <ChevronDownSmallIcon
                  className={`crm-dropdown-arrow ${isTypeOpen ? "open" : ""}`}
                />
              </div>
              <div
                className={`crm-dropdown-options ${isTypeOpen ? "open" : hasTypeOpened ? "closed" : ""}`}
              >
                {(["All", "Bronze", "Silver", "Gold", "Platinum"] as const).map(
                  (opt) => (
                    <div
                      key={opt}
                      className={`crm-dropdown-option ${typeFilter === opt ? "active" : ""}`}
                      onClick={() => {
                        actions.changeTypeFilter(opt);
                        setIsTypeOpen(false);
                      }}
                    >
                      {opt}
                    </div>
                  ),
                )}
              </div>
            </div>

            <button
              type="button"
              className="crm-btn-clear"
              onClick={actions.clearFilters}
            >
              Clear Filter
            </button>
          </div>

          <div className="crm-bulk-actions">
            <button
              type="button"
              className="crm-btn-bulk"
              onClick={bulkActions.bulkActivate}
              disabled={selectedIds.size === 0}
            >
              Bulk Activate
            </button>
            <button
              type="button"
              className="crm-btn-bulk"
              onClick={bulkActions.bulkDeactivate}
              disabled={selectedIds.size === 0}
            >
              Bulk Deactivate
            </button>
            <button
              type="button"
              className="crm-btn-bulk danger"
              onClick={bulkActions.bulkDelete}
              disabled={selectedIds.size === 0}
            >
              Bulk Delete
            </button>
          </div>
        </div>

        <div className="crm-table-wrapper">
          <table className="crm-table">
            <thead>
              <tr>
                <th className="crm-col-select">
                  <input
                    type="checkbox"
                    className="crm-checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isPartiallySelected;
                    }}
                    onChange={(e) => actions.toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="crm-col-name">Customer Name</th>
                <th className="crm-col-email">Email</th>
                <th className="crm-col-type">Customer Type</th>
                <th className="crm-col-status">Status</th>
                <th className="crm-col-login">Last Login</th>
                <th className="crm-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((record) => (
                  <tr
                    key={record.id}
                    className={
                      selectedIds.has(record.id) ? "crm-selected-row" : ""
                    }
                  >
                    <td data-label="Select Customer">
                      <input
                        type="checkbox"
                        className="crm-checkbox"
                        checked={selectedIds.has(record.id)}
                        onChange={() => actions.toggleSelection(record.id)}
                      />
                    </td>
                    <td data-label="Customer Name">
                      <div className="crm-user-cell">
                        <div className="crm-avatar">
                          <DefaultAvatarIcon />
                        </div>
                        <span className="crm-text-strong">
                          {record.fullName}
                        </span>
                      </div>
                    </td>
                    <td data-label="Email">
                      <a href={`mailto:${record.email}`} className="crm-link">
                        {record.email}
                      </a>
                    </td>
                    <td data-label="Customer Type">{record.customerType}</td>
                    <td data-label="Status">
                      {renderStatusBadge(record.status)}
                    </td>
                    <td data-label="Last Login" className="crm-text-muted">
                      {record.lastLogin}
                    </td>
                    <td data-label="Actions">
                      <div
                        className="crm-row-actions"
                        ref={openActionId === record.id ? actionMenuRef : null}
                      >
                        <button
                          type="button"
                          className="crm-icon-btn"
                          title="View Details"
                          onClick={() => actions.openViewModal(record)}
                        >
                          <EyeIcon />
                        </button>
                        <button
                          type="button"
                          className="crm-icon-btn"
                          title="Edit Customer"
                          onClick={() => actions.openEditModal(record)}
                        >
                          <EditUserIcon />
                        </button>
                        <div className="crm-toggle-cell">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={record.status === "Active"}
                            className={`crm-table-toggle ${record.status === "Active" ? "on" : ""}`}
                            onClick={() =>
                              toggleRowStatus(record.id, record.status)
                            }
                            disabled={record.status === "Locked"}
                            title="Toggle Status"
                          ></button>
                        </div>
                        <button
                          type="button"
                          className="crm-icon-btn"
                          title="More Options"
                          onClick={() =>
                            setOpenActionId(
                              openActionId === record.id ? null : record.id,
                            )
                          }
                        >
                          <MoreHorizontalIcon />
                        </button>

                        {openActionId === record.id && (
                          <div className="crm-action-menu">
                            <button
                              className="crm-action-item crm-item-delete"
                              onClick={() => {
                                actions.openDeleteModal(record);
                                setOpenActionId(null);
                              }}
                            >
                              Delete User
                            </button>
                            {record.status === "Locked" ? (
                              <button
                                type="button"
                                className="crm-action-item crm-item-unlock"
                                onClick={() => {
                                  actions.lockUnlockCustomer(
                                    record.id,
                                    record.status,
                                  );
                                  setOpenActionId(null);
                                }}
                              >
                                Unlock User
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="crm-action-item crm-item-lock"
                                onClick={() => {
                                  actions.lockUnlockCustomer(
                                    record.id,
                                    record.status,
                                  );
                                  setOpenActionId(null);
                                }}
                              >
                                Lock User
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="crm-empty-state">
                    No customers found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="crm-pagination">
          <span className="crm-pagination-info">
            Showing{" "}
            {pagination.totalFiltered === 0 ? 0 : pagination.startIndex + 1} to{" "}
            {Math.min(
              pagination.startIndex + pagination.limit,
              pagination.totalFiltered,
            )}{" "}
            of {pagination.totalFiltered} users
          </span>
          <div className="crm-page-numbers">
            <button
              className="crm-page-num"
              disabled={pagination.page === 1}
              onClick={() => actions.changePage(pagination.page - 1)}
            >
              &lt;
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (num) => (
                <button
                  key={num}
                  className={`crm-page-num ${pagination.page === num ? "active" : ""}`}
                  onClick={() => actions.changePage(num)}
                >
                  {num}
                </button>
              ),
            )}
            <button
              className="crm-page-num"
              disabled={
                pagination.page === pagination.totalPages ||
                pagination.totalPages === 0
              }
              onClick={() => actions.changePage(pagination.page + 1)}
            >
              &gt;
            </button>

            <div className="crm-limit-dropdown" ref={limitRef}>
              <div
                className={`crm-limit-trigger ${isLimitDropdownOpen ? "active" : ""}`}
                onClick={() => {
                  setIsLimitDropdownOpen(!isLimitDropdownOpen);
                  if (!hasLimitOpened) setHasLimitOpened(true);
                }}
              >
                <span>{pagination.limit} / page</span>
                <div
                  className={`crm-limit-icon ${isLimitDropdownOpen ? "open" : ""}`}
                >
                  <ChevronDownSmallIcon />
                </div>
              </div>
              <div
                className={`crm-limit-options ${isLimitDropdownOpen ? "open" : hasLimitOpened ? "closed" : ""}`}
              >
                {[10, 20, 50].map((val) => (
                  <div
                    key={val}
                    className={`crm-limit-option ${pagination.limit === val ? "active" : ""}`}
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
