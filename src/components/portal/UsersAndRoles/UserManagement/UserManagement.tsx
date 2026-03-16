import { useState, useEffect, useRef } from "react";
import "./UserManagement.css";

import {
  ViewIcon,
  EditIcon,
  DotsIcon,
  TrashIcon,
  LockIcon,
  UnlockIcon,
} from "../../../../assets/icons/UserManagementIcons";
import type { User } from "./UserModal";
import type { BulkAction } from "../../../../pages/portal/UsersAndRoles/UserManagement/UserManagementPage";

// props truyền từ container
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
  actions: {
    changeFilter: (key: "search" | "status" | "role", val: string) => void;
    clearFilter: () => void;
    changePage: (page: number) => void;
    changeLimit: (limit: number) => void;
    selectUser: (id: number) => void;
    selectAll: (isAll: boolean) => void;
    bulk: (action: BulkAction) => void;
    toggleStatus: (id: number, status: string) => void;
    lockUnlock: (id: number, status: string) => void;
    deleteSingle: (id: number) => void;
    openModal: (mode: "add" | "edit" | "view", user?: User) => void;
  };
}

interface DropdownOption {
  label: string;
  value: string;
}

// component dropdown
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Tắt dropdown khi click ngoài vùng dropdown
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
    <div className={`um-custom-dropdown ${className}`} ref={dropdownRef}>
      <div
        className={`um-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedLabel}</span>
        <svg
          className={`um-dropdown-arrow ${isOpen ? "open" : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#333"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      {isOpen && (
        <div className="um-dropdown-options">
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
      )}
    </div>
  );
}

// data mock bộ lọc
const STATUS_OPTIONS: DropdownOption[] = [
  { label: "All Status", value: "Status" },
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
  { label: "Locked", value: "Locked" },
];

const ROLE_OPTIONS: DropdownOption[] = [
  { label: "All Roles", value: "Role" },
  { label: "Administrator", value: "Administrator" },
  { label: "Content Manager", value: "Content Manager" },
  { label: "Sale Staff", value: "Sale Staff" },
];

const PAGE_OPTIONS: DropdownOption[] = [
  { label: "5 / page", value: "5" },
  { label: "10 / page", value: "10" },
  { label: "20 / page", value: "20" },
  { label: "50 / page", value: "50" },
];

// ui chính của bảng người dùng
export default function UserManagement({
  data,
  filters,
  pagination,
  actions,
}: UserManagementProps) {
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  // Tắt menu "..." khi click ra ngoài
  useEffect(() => {
    const handleGlobalClick = () => setOpenDropdownId(null);
    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, []);

  const isAllSelected = data.length > 0 && data.every((user) => user.selected);
  const pageNumbers = Array.from(
    { length: pagination.totalPages },
    (_, i) => i + 1,
  );

  return (
    <div className="um-container">
      {/* header và nút tạo mới */}
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

      {/* khung trắng bọc ngoài bảng tool */}
      <div className="um-filters-card">
        {/* thanh search và filter */}
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
            options={STATUS_OPTIONS}
            onChange={(val) => actions.changeFilter("status", val)}
            className="um-filter-dropdown"
          />
          <CustomDropdown
            value={filters.role}
            options={ROLE_OPTIONS}
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

        {/* cụm nút thao tác chọn nhiều */}
        <div className="um-bulk-actions">
          <button
            type="button"
            className="um-btn-bulk"
            onClick={(e) => {
              actions.bulk("activate");
              e.currentTarget.blur();
            }}
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
          >
            Bulk Delete
          </button>
        </div>

        {/* cuộn ngang cho bảng */}
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
              {/* lặp data ra dòng bảng */}
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

                        {/* nút switch đóng mở trạng thái */}
                        <div
                          className={`um-toggle-switch ${user.status === "Active" ? "on" : ""} ${user.status === "Locked" ? "disabled" : ""}`}
                          onClick={() =>
                            actions.toggleStatus(user.id, user.status)
                          }
                          role="switch"
                          aria-checked={user.status === "Active"}
                        ></div>

                        <div className="um-dropdown-wrapper">
                          <button
                            type="button"
                            className="um-icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(
                                openDropdownId === user.id ? null : user.id,
                              );
                            }}
                          >
                            <DotsIcon fill="#111827" />
                          </button>

                          {/* menu popup 3 chấm */}
                          {openDropdownId === user.id && (
                            <div
                              className="um-dropdown-menu"
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
                          )}
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

        {/* phân trang */}
        <div className="um-pagination">
          <div>
            Showing{" "}
            {pagination.totalFiltered === 0 ? 0 : pagination.startIndex + 1}-
            {Math.min(pagination.endIndex, pagination.totalFiltered)} of{" "}
            {pagination.totalFiltered} users
          </div>
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

            <CustomDropdown
              value={pagination.limit.toString()}
              options={PAGE_OPTIONS}
              onChange={(val) => actions.changeLimit(Number(val))}
              className="um-page-dropdown"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
