import { useState } from "react";
import "./RoleManagement.css";

import {
  type Role,
  type ModulePermission,
  STANDARD_ACTIONS,
} from "../../../../hooks/portal/UserAndRoles/RoleManagement/useRoleManagement";
import {
  EditIcon,
  TrashIcon,
  LockIcon,
} from "../../../../assets/icons/UserManagementIcons";
import {
  WarningIcon,
  MinusSquareIcon,
  PlusSquareIcon,
  CheckIcon,
} from "../../../../assets/icons/RoleManagementIcons";

interface RoleManagementProps {
  data: {
    roles: Role[];
    permissions: ModulePermission[];
  };
  uiState: {
    selectedRoleId: string | null;
    hasUnsavedChanges: boolean;
    searchTerm: string;
  };
  actions: {
    changeSearch: (val: string) => void;
    selectRole: (id: string) => void;
    togglePermission: (moduleId: string, subId: string, action: string) => void;
    saveChanges: () => void;
    cancelChanges: () => void;
    openModal: (mode: "add" | "edit", role?: Role) => void;
    deleteRole: (id: string) => void;
  };
}

export default function RoleManagement({
  data,
  uiState,
  actions,
}: RoleManagementProps) {
  const [expandedModules, setExpandedModules] = useState<
    Record<string, boolean>
  >({});

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: prev[moduleId] === undefined ? false : !prev[moduleId],
    }));
  };

  const selectedRole = data.roles.find((r) => r.id === uiState.selectedRoleId);
  const filteredRoles = data.roles.filter((r) =>
    r.name.toLowerCase().includes(uiState.searchTerm.toLowerCase()),
  );

  return (
    <div className="rm-container">
      <div className="rm-header">
        <div>
          <h1 className="rm-title">Roles Management</h1>
          <p className="rm-breadcrumb">Users & Roles / Roles Management</p>
        </div>
      </div>

      <div className="rm-layout">
        <div className="rm-left-panel">
          <div className="rm-left-header">
            <h2 className="rm-panel-title">Roles</h2>
            <button
              className="rm-btn-add"
              onClick={() => actions.openModal("add")}
            >
              + Add New Role
            </button>
          </div>

          <div className="rm-search-box">
            <input
              type="text"
              className="rm-search-input"
              placeholder="Search"
              value={uiState.searchTerm}
              onChange={(e) => actions.changeSearch(e.target.value)}
            />
          </div>

          <div className="rm-roles-list">
            <div className="rm-roles-head">
              <span className="rm-col-role">Role</span>
              <span className="rm-col-status">Status</span>
            </div>

            {filteredRoles.map((role) => (
              <div
                key={role.id}
                className={`rm-role-item ${uiState.selectedRoleId === role.id ? "active" : ""}`}
                onClick={() => actions.selectRole(role.id)}
              >
                <div className="rm-role-name">
                  {role.name}
                  {role.isLocked && (
                    <span className="rm-lock-icon" title="System Role">
                      <LockIcon stroke="#666" />
                    </span>
                  )}
                </div>
                <div className="rm-role-status">
                  <span
                    className={`rm-status-text ${role.status.toLowerCase()}`}
                  >
                    {role.status}
                  </span>
                </div>
                <div className="rm-role-actions">
                  <button
                    className={`rm-icon-btn ${role.isLocked ? "disabled" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.openModal("edit", role);
                    }}
                    disabled={role.isLocked}
                  >
                    <EditIcon stroke={role.isLocked ? "#ccc" : "#111827"} />
                  </button>
                  <button
                    className={`rm-icon-btn ${role.isLocked ? "disabled" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!role.isLocked) actions.deleteRole(role.id);
                    }}
                    disabled={role.isLocked}
                  >
                    <TrashIcon stroke={role.isLocked ? "#ccc" : "#111827"} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {uiState.selectedRoleId !== null && (
          <div className="rm-right-panel">
            <div className="rm-right-header">
              <div className="rm-right-title-group">
                <h2 className="rm-role-title">Role: {selectedRole?.name}</h2>
                {uiState.hasUnsavedChanges && (
                  <span className="rm-unsaved-tag">
                    <WarningIcon />
                    Unsaved Changes
                  </span>
                )}
              </div>
              <div className="rm-right-actions">
                <button
                  className="rm-btn-save"
                  disabled={!uiState.hasUnsavedChanges}
                  onClick={actions.saveChanges}
                >
                  Save Changes
                </button>
                <button
                  className="rm-btn-cancel"
                  onClick={actions.cancelChanges}
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="rm-permissions-container">
              {data.permissions.map((module) => {
                const isExpanded = expandedModules[module.moduleId] !== false;

                // ÉP CỐ ĐỊNH 5 CỘT CHO TẤT CẢ CÁC NHÓM
                const gridColumnsStyle = {
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: "10px",
                };

                return (
                  <div key={module.moduleId} className="rm-module-card">
                    <div
                      className="rm-module-header"
                      onClick={() => toggleModule(module.moduleId)}
                    >
                      <div className="rm-module-name-col">
                        <button className="rm-toggle-btn">
                          {isExpanded ? (
                            <MinusSquareIcon />
                          ) : (
                            <PlusSquareIcon />
                          )}
                        </button>
                        <span className="rm-module-title">
                          {module.moduleName}
                        </span>
                      </div>

                      {/* --- RENDER HEADERS LUÔN HIỆN CHỮ OTHER --- */}
                      <div className="rm-perm-headers" style={gridColumnsStyle}>
                        {STANDARD_ACTIONS.map((action) => (
                          <span key={action}>{action}</span>
                        ))}
                        <span>OTHER</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="rm-submodules-list">
                        {module.subModules.map((sub) => (
                          <div key={sub.subId} className="rm-submodule-row">
                            <div className="rm-submodule-name">
                              {sub.subName}
                            </div>

                            <div
                              className="rm-perm-checkboxes"
                              style={gridColumnsStyle}
                            >
                              {/* 1. RENDER 4 CỘT CRUD CHUẨN */}
                              {STANDARD_ACTIONS.map((action) => {
                                const isActionAvailable =
                                  sub.availableActions.includes(action);

                                if (!isActionAvailable) {
                                  return (
                                    <span
                                      key={action}
                                      className="rm-checkbox-label"
                                      style={{ visibility: "hidden" }}
                                    ></span>
                                  );
                                }

                                return (
                                  <label
                                    key={action}
                                    className="rm-checkbox-label"
                                  >
                                    <input
                                      type="checkbox"
                                      className="rm-checkbox"
                                      checked={sub.grantedActions.includes(
                                        action,
                                      )}
                                      onChange={() =>
                                        actions.togglePermission(
                                          module.moduleId,
                                          sub.subId,
                                          action,
                                        )
                                      }
                                    />
                                    <span className="rm-custom-check">
                                      <CheckIcon />
                                    </span>
                                    <span className="rm-checkbox-text">
                                      {action}
                                    </span>
                                  </label>
                                );
                              })}

                              {/* 2. RENDER CỘT OTHER BỔ SUNG */}
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gridTemplateColumns: "1fr",
                                  gap: "8px",
                                  alignItems: "flex-start",
                                }}
                              >
                                {module.uniqueOtherActions &&
                                module.uniqueOtherActions.length > 0 ? (
                                  module.uniqueOtherActions.map((action) => {
                                    const isActionAvailable =
                                      sub.availableActions.includes(action);

                                    // Ẩn checkbox nếu không có quyền này
                                    if (!isActionAvailable) {
                                      return (
                                        <span
                                          key={action}
                                          className="rm-checkbox-label"
                                          style={{
                                            visibility: "hidden",
                                            height: "20px",
                                          }}
                                        ></span>
                                      );
                                    }

                                    return (
                                      <label
                                        key={action}
                                        className="rm-checkbox-label"
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "flex-start", // Ép lề trái cực mạnh đè lên CSS cũ
                                          margin: 0,
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          className="rm-checkbox"
                                          checked={sub.grantedActions.includes(
                                            action,
                                          )}
                                          onChange={() =>
                                            actions.togglePermission(
                                              module.moduleId,
                                              sub.subId,
                                              action,
                                            )
                                          }
                                        />
                                        <span className="rm-custom-check">
                                          <CheckIcon />
                                        </span>
                                        <span className="rm-checkbox-text">
                                          {action}
                                        </span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  // Khối tàng hình để giữ chuẩn grid 5 cột cho Dashboard / các mục không có OTHER
                                  <span
                                    className="rm-checkbox-label"
                                    style={{
                                      visibility: "hidden",
                                      height: "20px",
                                    }}
                                  ></span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
