// imports
import { useState } from "react";
import "./RoleModal.css";
import type {
  Role,
  RoleFormData,
} from "../../../../hooks/portal/UserAndRoles/RoleManagement/useRoleManagement";
import { CloseIcon } from "../../../../assets/icons/RoleManagementIcons";

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
    status: initialData?.status || "Active",
  });

  // Điều kiện kích hoạt nút Submit
  const isValid = formData.name.trim().length > 0;

  // handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
  };

  const handleToggleStatus = () => {
    if (initialData?.isLocked) return;
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
            <label>Roles Status</label>
            <div className="rm-modal-status-flex">
              <div
                className={`rm-modal-switch ${formData.status === "Active" ? "on" : ""} ${initialData?.isLocked ? "disabled" : ""}`}
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
