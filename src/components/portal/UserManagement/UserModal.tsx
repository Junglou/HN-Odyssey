import React, { useState } from "react";
import "./UserModal.css";

// Interface chuẩn dùng chung
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string;
  selected: boolean;
}

export interface UserFormData {
  name: string;
  email: string;
  username: string;
  password?: string;
  role: string;
  status: string;
}

interface UserModalProps {
  isOpen: boolean;
  mode: "add" | "edit" | "view";
  initialData: User | null;
  onClose: () => void;
  onSubmit: (data: UserFormData) => void;
}

const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<UserFormData>({
    name: initialData?.name || "",
    email: initialData?.email || "",
    username: initialData?.email.split("@")[0] || "",
    password: mode === "add" ? "" : "••••••••",
    role: initialData?.role || "",
    status: initialData?.status || "Active",
  });

  // Tự động vô hiệu hóa form nếu đang ở chế độ xem
  const isViewOnly = mode === "view";

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.role) {
      alert("Vui lòng điền đầy đủ các trường bắt buộc (*)");
      return;
    }
    onSubmit(formData);
  };

  const handleToggleStatus = () => {
    if (!isViewOnly) {
      setFormData((prev) => ({
        ...prev,
        status: prev.status === "Active" ? "Inactive" : "Active",
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="um-modal-overlay">
      <div className="um-modal-box">
        <h2 className="um-modal-title">
          {mode === "add"
            ? "Add User"
            : mode === "edit"
              ? "Edit User"
              : "User Details"}
        </h2>

        <form onSubmit={handleFormSubmit} className="um-modal-form">
          <div className="um-form-group">
            <label>
              Full Name <span className="req">*</span>
            </label>
            <input
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              disabled={isViewOnly}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="um-form-group">
            <label>
              Email Address <span className="req">*</span>
            </label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              disabled={isViewOnly}
              placeholder="Enter email"
              required
            />
          </div>

          <div className="um-form-row">
            <div className="um-form-group">
              <label>
                Username <span className="req">*</span>
              </label>
              <input
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                disabled={isViewOnly}
                placeholder="Enter username"
                required
              />
            </div>
            <div className="um-form-group">
              <label>
                Password <span className="req">*</span>
              </label>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                disabled={isViewOnly}
                placeholder="Enter password"
                required={mode === "add"}
              />
            </div>
          </div>

          <div className="um-form-group">
            <label>
              Role <span className="req">*</span>
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              disabled={isViewOnly}
              required
            >
              {/* Thêm thuộc tính 'hidden' để ẩn dòng chữ xám này đi khi sổ menu xuống */}
              <option value="" disabled hidden>
                Select Role
              </option>
              <option value="Administrator">Administrator</option>
              <option value="Content Manager">Content Manager</option>
              <option value="Sale Staff">Sale Staff</option>
            </select>
          </div>

          <div className="um-form-group">
            <label>{mode === "view" ? "Status" : "Account Status"}</label>
            <div className="um-modal-status-flex">
              <div
                className={`um-modal-switch ${
                  formData.status === "Active" ? "on" : ""
                } ${isViewOnly ? "disabled" : ""}`}
                onClick={handleToggleStatus}
              >
                <div className="um-modal-switch-handle"></div>
              </div>
              <span className="um-modal-status-text">{formData.status}</span>
            </div>
          </div>

          <div className="um-modal-actions">
            {!isViewOnly ? (
              <>
                <button type="submit" className="um-btn-modal-submit">
                  {mode === "add" ? "Create User" : "Save Changes"}
                </button>
                <button
                  type="button"
                  className="um-btn-modal-cancel"
                  onClick={onClose}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="um-btn-modal-cancel"
                onClick={onClose}
              >
                Close
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;
