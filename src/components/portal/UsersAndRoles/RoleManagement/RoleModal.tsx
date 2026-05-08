import { useState } from "react";
import "./RoleModal.css";
import type {
  Role,
  RoleFormData,
} from "../../../../hooks/portal/UserAndRoles/RoleManagement/useRoleManagement";
import { CloseIcon } from "../../../../assets/icons/RoleManagementIcons";

interface RoleModalProps {
  isOpen: boolean;
  mode: "add" | "edit";
  initialData: Role | null;
  onClose: () => void;
  onSubmit: (data: RoleFormData) => void;
}

export default function RoleModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}: RoleModalProps) {
  // Không cần dùng useEffect, File Page cha đã gán "key" cho component
  // Mỗi khi Modal mở, React sẽ khởi tạo lại toàn bộ vòng đời Component này với Data mới
  const [formData, setFormData] = useState<RoleFormData>({
    name: initialData?.name || "",
    status: initialData?.status || "Active",
  });

  if (!isOpen) return null;

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
    if (!formData.name.trim()) return;
    onSubmit(formData);
  };

  return (
    <div className="rm-modal-overlay">
      <div className="rm-modal-box">
        <div className="rm-modal-header">
          <h2 className="rm-modal-title">
            {mode === "add" ? "Add Role" : "Edit Role"}
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
            <label>Account Status</label>
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
            <button type="submit" className="rm-btn-modal-submit">
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
