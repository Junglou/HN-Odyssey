// imports
import { useState, useRef, useEffect } from "react";
import "./UserManagement.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import {
  ViewIcon,
  EditIcon,
  DotsIcon,
  TrashIcon,
  LockIcon,
  UnlockIcon,
  ChevronDownSmallIcon,
} from "../../../../assets/icons/UserManagementIcons";
import type { User } from "./UserModal";
import type {
  BulkAction,
  DropdownOption,
} from "../../../../hooks/portal/UserAndRoles/UserManagement/useUserManagement";

// types
interface UserManagementProps {
  data: User[];
  filters: { search: string; status: string; role: string };
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    startIndex: number;
    endIndex: number;
    totalFiltered: number;
  };
  options: {
    roles: DropdownOption[];
    status: DropdownOption[];
  };
  actions: {
    changeFilter: (key: "search" | "status" | "role", val: string) => void;
    clearFilter: () => void;
    changePage: (page: number) => void;
    changeLimit: (limit: number) => void;
    selectUser: (id: string) => void;
    selectAll: (isAll: boolean) => void;
    bulk: (action: BulkAction) => void;
    toggleStatus: (id: string, status: string) => void;
    lockUnlock: (id: string, status: string) => void;
    deleteSingle: (id: string) => void;
    openModal: (mode: "add" | "edit" | "view", user?: User) => void;
  };
}

// helpers
function CustomDropdown({
  value,
  options,
  onChange,
  className = "",
}: {
  value: string;
  options: DropdownOption[];
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

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || options[0]?.label;

  return (
    <div
      className={`um-custom-dropdown ${className} ${isOpen ? "is-open" : ""}`}
      ref={dropdownRef}
    >
      <div
        className={`um-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        <span>{selectedLabel}</span>
        <ChevronDownSmallIcon
          className={`um-dropdown-arrow ${isOpen ? "open" : ""}`}
          style={{ color: "#333" }}
        />
      </div>

      <div
        className={`um-dropdown-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`um-dropdown-option ${value === opt.value ? "selected" : ""}`}
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

// component
export default function UserManagement({
  data,
  filters,
  pagination,
  options,
  actions,
}: UserManagementProps) {
  // state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [hasDropdownOpened, setHasDropdownOpened] = useState<
    Record<string, boolean>
  >({});

  const [isLimitDropdownOpen, setIsLimitDropdownOpen] = useState(false);
  const [hasLimitOpened, setHasLimitOpened] = useState(false);
  const limitRef = useRef<HTMLDivElement>(null);
  useClickOutside(limitRef, () => setIsLimitDropdownOpen(false));

  const isAllSelected = data.length > 0 && data.every((user) => user.selected);
  const hasSelection = data.some((user) => user.selected);
  const pageNumbers = Array.from(
    { length: pagination.totalPages },
    (_, i) => i + 1,
  );

  // render
  return (
    <div className="um-container">
      <div className="um-header">
        <div>
          <h1 className="um-title">User Management</h1>
          <p className="um-breadcrumb">Users & Roles / User Management</p>
        </div>
        <button
          type="button"
          className="um-btn-add"
          onClick={() => actions.openModal("add")}
        >
          + Add New User
        </button>
      </div>

      <div className="um-filters-card">
        <div className="um-filters-row">
          <input
            type="text"
            className="um-filter-input"
            placeholder="Search by name or email"
            value={filters.search}
            onChange={(e) => actions.changeFilter("search", e.target.value)}
          />
          <CustomDropdown
            value={filters.status}
            options={options.status}
            onChange={(val) => actions.changeFilter("status", val)}
            className="um-filter-dropdown"
          />
          <CustomDropdown
            value={filters.role}
            options={options.roles}
            onChange={(val) => actions.changeFilter("role", val)}
            className="um-filter-dropdown"
          />
          <button
            type="button"
            className="um-btn-clear"
            onClick={(e) => {
              actions.clearFilter();
              e.currentTarget.blur();
            }}
          >
            Clear Filter
          </button>
        </div>

        <div className="um-bulk-actions">
          <button
            type="button"
            className="um-btn-bulk"
            onClick={(e) => {
              actions.bulk("activate");
              e.currentTarget.blur();
            }}
            disabled={!hasSelection}
          >
            Bulk Activate
          </button>
          <button
            type="button"
            className="um-btn-bulk"
            onClick={(e) => {
              actions.bulk("deactivate");
              e.currentTarget.blur();
            }}
            disabled={!hasSelection}
          >
            Bulk Deactivate
          </button>
          <button
            type="button"
            className="um-btn-bulk delete"
            onClick={(e) => {
              actions.bulk("delete");
              e.currentTarget.blur();
            }}
            disabled={!hasSelection}
          >
            Bulk Delete
          </button>
        </div>

        <div className="um-table-wrapper">
          <table className="um-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={() => actions.selectAll(isAllSelected)}
                  />{" "}
                  User Name
                </th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((user) => (
                  <tr
                    key={user.id}
                    className={user.selected ? "um-selected-row" : ""}
                  >
                    <td data-label="User Name">
                      <div className="um-td-flex">
                        <input
                          type="checkbox"
                          checked={user.selected}
                          onChange={() => actions.selectUser(user.id)}
                        />
                        <span>👤 {user.name}</span>
                      </div>
                    </td>
                    <td className="um-td-email" data-label="Email">
                      {user.email}
                    </td>
                    <td data-label="Role">{user.role}</td>
                    <td data-label="Status">
                      <span className={`um-status-badge status-${user.status}`}>
                        <span className="um-dot"></span> {user.status}
                      </span>
                    </td>
                    <td data-label="Last Login">{user.lastLogin}</td>
                    <td data-label="Actions">
                      <div className="um-action-group">
                        <button
                          type="button"
                          className="um-icon-btn"
                          onClick={() => actions.openModal("view", user)}
                        >
                          <ViewIcon stroke="#111827" />
                        </button>
                        <button
                          type="button"
                          className="um-icon-btn"
                          onClick={() => actions.openModal("edit", user)}
                        >
                          <EditIcon stroke="#111827" />
                        </button>

                        {/* Nút toggle trạng thái (Chặn thao tác nếu user đang Locked) */}
                        <div
                          className={`um-toggle-switch ${user.status === "Active" ? "on" : ""} ${user.status === "Locked" ? "disabled" : ""}`}
                          onClick={() => {
                            if (user.status !== "Locked") {
                              actions.toggleStatus(user.id, user.status);
                            }
                          }}
                          role="switch"
                          aria-checked={user.status === "Active"}
                        ></div>

                        <div
                          className={`um-dropdown-wrapper ${openDropdownId === user.id ? "is-open" : ""}`}
                        >
                          <button
                            type="button"
                            className="um-icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              const isOpening = openDropdownId !== user.id;
                              setOpenDropdownId(isOpening ? user.id : null);
                              if (isOpening && !hasDropdownOpened[user.id]) {
                                setHasDropdownOpened((prev) => ({
                                  ...prev,
                                  [user.id]: true,
                                }));
                              }
                            }}
                          >
                            <DotsIcon fill="#111827" />
                          </button>

                          <div
                            className={`um-dropdown-menu ${openDropdownId === user.id ? "open" : hasDropdownOpened[user.id] ? "closed" : ""}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="um-dropdown-item um-item-delete"
                              onClick={() => {
                                actions.deleteSingle(user.id);
                                setOpenDropdownId(null);
                              }}
                            >
                              <TrashIcon stroke="#ffffff" /> Delete
                            </button>
                            {user.status === "Locked" ? (
                              <button
                                type="button"
                                className="um-dropdown-item um-item-unlock"
                                onClick={() => {
                                  actions.lockUnlock(user.id, user.status);
                                  setOpenDropdownId(null);
                                }}
                              >
                                <UnlockIcon stroke="#111827" /> Unlock
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="um-dropdown-item um-item-lock"
                                onClick={() => {
                                  actions.lockUnlock(user.id, user.status);
                                  setOpenDropdownId(null);
                                }}
                              >
                                <LockIcon stroke="#111827" /> Lock
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="um-td-empty">
                    No users found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="um-pagination">
          <span>
            Showing{" "}
            {pagination.totalFiltered === 0 ? 0 : pagination.startIndex + 1} -{" "}
            {Math.min(pagination.endIndex, pagination.totalFiltered)} of{" "}
            {pagination.totalFiltered} users
          </span>

          <div className="um-page-numbers">
            <button
              type="button"
              className="um-page-num"
              style={{
                opacity: pagination.page === 1 ? 0.4 : 1,
                pointerEvents: pagination.page === 1 ? "none" : "auto",
              }}
              onClick={() =>
                actions.changePage(Math.max(pagination.page - 1, 1))
              }
            >
              &lt;
            </button>

            {pageNumbers.map((num) => (
              <button
                type="button"
                key={num}
                className={`um-page-num ${pagination.page === num ? "active" : ""}`}
                onClick={() => actions.changePage(num)}
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              className="um-page-num"
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
              onClick={() =>
                actions.changePage(
                  Math.min(pagination.page + 1, pagination.totalPages),
                )
              }
            >
              &gt;
            </button>

            <div className="um-limit-dropdown" ref={limitRef}>
              <div
                className={`um-limit-trigger ${isLimitDropdownOpen ? "active" : ""}`}
                onClick={() => {
                  setIsLimitDropdownOpen(!isLimitDropdownOpen);
                  if (!hasLimitOpened) setHasLimitOpened(true);
                }}
              >
                <span>{pagination.limit} / page</span>
                <div
                  className={`um-limit-icon ${isLimitDropdownOpen ? "open" : ""}`}
                >
                  <ChevronDownSmallIcon />
                </div>
              </div>
              <div
                className={`um-limit-options ${isLimitDropdownOpen ? "open" : hasLimitOpened ? "closed" : ""}`}
              >
                {[5, 10, 20, 50].map((val) => (
                  <div
                    key={val}
                    className={`um-limit-option ${pagination.limit === val ? "active" : ""}`}
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
