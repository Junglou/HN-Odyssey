// imports
import { useState, useRef, useEffect } from "react";
import "./RoleModal.css";
import {
  ROLE_LEVEL,
  type Role,
  type RoleFormData,
} from "../../../../hooks/portal/UserAndRoles/RoleManagement/useRoleManagement";
import { CloseIcon } from "../../../../assets/icons/RoleManagementIcons";
import { ChevronDownSmallIcon } from "../../../../assets/icons/OrderManagementIcons";
import { getCurrentUser, hasPermission } from "../../../../utils/permission";
import { Action, Resource } from "../../../../types/permissions";

// Mỗi cấp nói rõ hệ quả thực tế, để người cấu hình hiểu chọn cấp nào thì được gì
const LEVEL_OPTIONS: Array<{ value: number; label: string; hint: string }> = [
  {
    value: ROLE_LEVEL.BOARD,
    label: "Board",
    hint: "Executives. Receives manager-only alerts and can turn Manager and Staff roles on or off.",
  },
  {
    value: ROLE_LEVEL.MANAGEMENT,
    label: "Manager",
    hint: "Department heads. Receives manager-only alerts such as overstock, BI anomalies and loyalty fraud.",
  },
  {
    value: ROLE_LEVEL.STAFF,
    label: "Staff",
    hint: "Operational staff. Receives alerts only for the screens this role can access.",
  },
];

// types
interface RoleModalProps {
  isOpen: boolean;
  mode: "add" | "edit";
  initialData: Role | null;
  onClose: () => void;
  onSubmit: (data: RoleFormData) => void;
}

// component wrapper (xử lý reset state tự động)
export default function RoleModal(props: RoleModalProps) {
  if (!props.isOpen) return null;
  const modalKey =
    props.mode === "add" ? "add-role" : `edit-${props.initialData?.id}`;
  return <RoleModalContent key={modalKey} {...props} />;
}

// sub-component (nội dung chính)
function RoleModalContent({
  mode,
  initialData,
  onClose,
  onSubmit,
}: Omit<RoleModalProps, "isOpen">) {
  // state
  const [formData, setFormData] = useState<RoleFormData>({
    name: initialData?.name || "",
    level: initialData?.level ?? ROLE_LEVEL.STAFF,
    status: initialData?.status || "Active",
  });

  // Dropdown cấp bậc (tự dựng để đồng bộ thiết kế Portal, không dùng <select> của trình duyệt)
  const [isLevelOpen, setIsLevelOpen] = useState(false);
  const [hasLevelOpened, setHasLevelOpened] = useState(false);
  const levelRef = useRef<HTMLDivElement>(null);
  const isLevelLocked = Boolean(initialData?.isLocked);

  useEffect(() => {
    if (!isLevelOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (levelRef.current && !levelRef.current.contains(e.target as Node)) {
        setIsLevelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isLevelOpen]);

  const isValid = formData.name.trim().length > 0;

  // Đổi trạng thái khi SỬA cần quyền CHANGE_STATUS; khi TẠO MỚI thì không cần
  const canChangeStatus = hasPermission(
    getCurrentUser(),
    Resource.SYSTEM_ROLES,
    Action.CHANGE_STATUS,
  );
  const isStatusLocked =
    Boolean(initialData?.isLocked) || (mode === "edit" && !canChangeStatus);

  const selectedLevel = LEVEL_OPTIONS.find((o) => o.value === formData.level);

  // handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
  };

  const toggleLevelDropdown = () => {
    if (isLevelLocked) return;
    setIsLevelOpen((open) => !open);
    if (!hasLevelOpened) setHasLevelOpened(true);
  };

  const handleSelectLevel = (level: number) => {
    setFormData((prev) => ({ ...prev, level }));
    setIsLevelOpen(false);
  };

  const handleToggleStatus = () => {
    if (isStatusLocked) return;
    setFormData((prev) => ({
      ...prev,
      status: prev.status === "Active" ? "Inactive" : "Active",
    }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSubmit(formData);
  };

  // render
  return (
    <div
      className="rm-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="rm-modal-box">
        <div className="rm-modal-header">
          <h2 className="rm-modal-title">
            {mode === "add" ? "Create New Role" : "Edit Role Settings"}
          </h2>
          <button
            type="button"
            className="rm-modal-close-icon"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="rm-modal-form">
          <div className="rm-form-group">
            <label>
              Role Name <span className="rm-req">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter role name"
              disabled={initialData?.isLocked}
              required
            />
          </div>

          <div className="rm-form-group">
            <label htmlFor="rm-role-level">Role Level</label>
            <div
              className={`rm-custom-dropdown ${isLevelLocked ? "disabled" : ""}`}
              ref={levelRef}
            >
              <div
                id="rm-role-level"
                role="button"
                tabIndex={isLevelLocked ? -1 : 0}
                aria-haspopup="listbox"
                aria-expanded={isLevelOpen}
                className={`rm-dropdown-trigger ${isLevelOpen ? "active" : ""}`}
                onClick={toggleLevelDropdown}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleLevelDropdown();
                  }
                  if (e.key === "Escape") setIsLevelOpen(false);
                }}
              >
                <span>{selectedLevel?.label ?? "Select level"}</span>
                <div
                  className={`rm-dropdown-arrow ${isLevelOpen ? "open" : ""}`}
                >
                  <ChevronDownSmallIcon />
                </div>
              </div>

              <div
                role="listbox"
                className={`rm-dropdown-options ${isLevelOpen ? "open" : hasLevelOpened ? "closed" : ""}`}
              >
                {LEVEL_OPTIONS.map((opt) => (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={formData.level === opt.value}
                    className={`rm-dropdown-option ${formData.level === opt.value ? "selected" : ""}`}
                    onClick={() => handleSelectLevel(opt.value)}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>
            {selectedLevel && (
              <p className="rm-form-hint">{selectedLevel.hint}</p>
            )}
          </div>

          <div className="rm-form-group">
            <label>Role Status</label>
            <div className="rm-modal-status-flex">
              <div
                className={`rm-modal-switch ${formData.status === "Active" ? "on" : ""} ${isStatusLocked ? "disabled" : ""}`}
                onClick={handleToggleStatus}
              >
                <div className="rm-modal-switch-handle"></div>
              </div>
              <span className="rm-modal-status-text">{formData.status}</span>
            </div>
          </div>

          <div className="rm-modal-actions">
            <button
              type="submit"
              className={`rm-btn-modal-submit ${isValid ? "active" : "disabled"}`}
              disabled={!isValid}
            >
              {mode === "add" ? "Create Role" : "Save Role"}
            </button>
            <button
              type="button"
              className="rm-btn-modal-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
