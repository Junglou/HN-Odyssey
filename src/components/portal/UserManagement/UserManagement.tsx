import React, { useState, useEffect, useRef } from "react";
import "./UserManagement.css";

// Import các icon từ file rời
import {
  ViewIcon,
  EditIcon,
  DotsIcon,
  TrashIcon,
  LockIcon,
  UnlockIcon,
} from "../../../assets/icons/UserManagementIcons";
import type { User } from "./UserModal";

interface UserManagementProps {
  currentUsers: User[];
  totalFiltered: number;
  searchTerm: string;
  statusFilter: string;
  roleFilter: string;
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  onSearchChange: (val: string) => void;
  onStatusChange: (val: string) => void;
  onRoleChange: (val: string) => void;
  onClearFilter: () => void;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (num: number) => void;
  onSelectUser: (id: number) => void;
  onSelectAll: (isAllSelected: boolean) => void;
  onBulkActivate: () => void;
  onBulkDeactivate: () => void;
  onBulkDelete: () => void;
  onToggleStatus: (id: number, status: string) => void;
  onLockUnlock: (id: number, status: string) => void;
  onDeleteSingle: (id: number) => void;
  onOpenModal: (mode: "add" | "edit" | "view", user?: User) => void;
}

const UserManagement: React.FC<UserManagementProps> = (props) => {
  // Quản lý trạng thái mở/đóng của menu 3 chấm
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Lắng nghe sự kiện click ra ngoài để đóng menu 3 chấm
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tableRef.current &&
        !tableRef.current.contains(event.target as Node)
      ) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Tính toán trạng thái tick chọn tất cả
  const isAllSelected =
    props.currentUsers.length > 0 &&
    props.currentUsers.every((user) => user.selected);
  const pageNumbers = Array.from({ length: props.totalPages }, (_, i) => i + 1);

  return (
    <>
      <div className="um-header">
        <div>
          <h1 className="um-title">User Management</h1>
          <p className="um-breadcrumb">Users & Roles / User Management</p>
        </div>
        <button className="um-btn-add" onClick={() => props.onOpenModal("add")}>
          + Add New User
        </button>
      </div>

      <div className="um-filters-card">
        <div className="um-filters-row">
          <input
            type="text"
            className="um-filter-input"
            placeholder="🔍 Search by name or email"
            value={props.searchTerm}
            onChange={(e) => props.onSearchChange(e.target.value)}
          />
          <select
            className="um-filter-select"
            value={props.statusFilter}
            onChange={(e) => props.onStatusChange(e.target.value)}
          >
            <option value="Status">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Locked">Locked</option>
          </select>
          <select
            className="um-filter-select"
            value={props.roleFilter}
            onChange={(e) => props.onRoleChange(e.target.value)}
          >
            <option value="Role">All Roles</option>
            <option value="Administrator">Administrator</option>
            <option value="Content Manager">Content Manager</option>
            <option value="Sale Staff">Sale Staff</option>
          </select>
          <button className="um-btn-clear" onClick={props.onClearFilter}>
            Clear Filter
          </button>
        </div>

        <div className="um-bulk-actions">
          <button className="um-btn-bulk" onClick={props.onBulkActivate}>
            Bulk Activate
          </button>
          <button className="um-btn-bulk" onClick={props.onBulkDeactivate}>
            Bulk Deactivate
          </button>
          <button className="um-btn-bulk delete" onClick={props.onBulkDelete}>
            Bulk Delete
          </button>
        </div>

        <div className="um-table-wrapper" ref={tableRef}>
          <table className="um-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={() => props.onSelectAll(isAllSelected)}
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
              {props.currentUsers.length > 0 ? (
                props.currentUsers.map((user) => (
                  <tr
                    key={user.id}
                    className={user.selected ? "um-selected-row" : ""}
                  >
                    <td>
                      <div className="um-td-flex">
                        <input
                          type="checkbox"
                          checked={user.selected}
                          onChange={() => props.onSelectUser(user.id)}
                        />
                        <span>👤 {user.name}</span>
                      </div>
                    </td>
                    <td className="um-td-email">{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      <span className={`um-status-badge status-${user.status}`}>
                        <span className="um-dot"></span> {user.status}
                      </span>
                    </td>
                    <td>{user.lastLogin}</td>
                    <td>
                      <div className="um-action-group">
                        <button
                          className="um-icon-btn"
                          onClick={() => props.onOpenModal("view", user)}
                        >
                          <ViewIcon stroke="#111827" />
                        </button>
                        <button
                          className="um-icon-btn"
                          onClick={() => props.onOpenModal("edit", user)}
                        >
                          <EditIcon stroke="#111827" />
                        </button>
                        <div
                          className={`um-toggle-switch ${user.status === "Active" ? "on" : ""} ${user.status === "Locked" ? "disabled" : ""}`}
                          onClick={() =>
                            props.onToggleStatus(user.id, user.status)
                          }
                        ></div>
                        <div className="um-dropdown-wrapper">
                          <button
                            className="um-icon-btn"
                            onClick={() =>
                              setOpenDropdownId(
                                openDropdownId === user.id ? null : user.id,
                              )
                            }
                          >
                            <DotsIcon fill="#111827" />
                          </button>
                          {openDropdownId === user.id && (
                            <div className="um-dropdown-menu">
                              <button
                                className="um-dropdown-item um-item-delete"
                                onClick={() => {
                                  props.onDeleteSingle(user.id);
                                  setOpenDropdownId(null);
                                }}
                              >
                                <TrashIcon stroke="#ffffff" /> Delete
                              </button>
                              {user.status === "Locked" ? (
                                <button
                                  className="um-dropdown-item um-item-unlock"
                                  onClick={() => {
                                    props.onLockUnlock(user.id, user.status);
                                    setOpenDropdownId(null);
                                  }}
                                >
                                  <UnlockIcon stroke="#111827" /> Unlock
                                </button>
                              ) : (
                                <button
                                  className="um-dropdown-item um-item-lock"
                                  onClick={() => {
                                    props.onLockUnlock(user.id, user.status);
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

        <div className="um-pagination">
          <div>
            Showing {props.totalFiltered === 0 ? 0 : props.startIndex + 1}-
            {Math.min(props.endIndex, props.totalFiltered)} of{" "}
            {props.totalFiltered} users
          </div>
          <div className="um-page-numbers">
            <span
              className="um-page-num"
              style={{
                opacity: props.currentPage === 1 ? 0.4 : 1,
                pointerEvents: props.currentPage === 1 ? "none" : "auto",
              }}
              onClick={() =>
                props.onPageChange(Math.max(props.currentPage - 1, 1))
              }
            >
              &lt;
            </span>

            {pageNumbers.map((num) => (
              <span
                key={num}
                className={`um-page-num ${props.currentPage === num ? "active" : ""}`}
                onClick={() => props.onPageChange(num)}
              >
                {num}
              </span>
            ))}

            <span
              className="um-page-num"
              style={{
                opacity:
                  props.currentPage === props.totalPages ||
                  props.totalPages === 0
                    ? 0.4
                    : 1,
                pointerEvents:
                  props.currentPage === props.totalPages ||
                  props.totalPages === 0
                    ? "none"
                    : "auto",
              }}
              onClick={() =>
                props.onPageChange(
                  Math.min(props.currentPage + 1, props.totalPages),
                )
              }
            >
              &gt;
            </span>

            <select
              className="um-page-select"
              value={props.itemsPerPage}
              onChange={(e) =>
                props.onItemsPerPageChange(Number(e.target.value))
              }
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserManagement;
