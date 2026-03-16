import { useState } from "react";
import "./UserModal.css";

// model user chung
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string;
  selected: boolean;
}

// schema form để trả dữ liệu về component cha
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

// modal form popup
export default function UserModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}: UserModalProps) {
  // khởi tạo state form (tự động refresh nhờ cơ chế key ở page ngoài)
  const [formData, setFormData] = useState<UserFormData>({
    name: initialData?.name || "",
    email: initialData?.email || "",
    username: initialData?.email.split("@")[0] || "",
    password: mode === "add" ? "" : "••••••••",
    role: initialData?.role || "",
    status: initialData?.status || "Active",
  });

  // check flag để vô hiệu hóa input
  const isViewOnly = mode === "view";

  // update state theo từng input
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // validate trước khi trả data ra ngoài
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.role) {
      alert("Vui lòng điền đầy đủ các trường bắt buộc (*)");
      return;
    }
    onSubmit(formData);
  };

  // Switch khóa/kích hoạt tài khoản
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

          {/* chia hai cột username và password */}
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
              <option value="" disabled hidden>
                Select Role
              </option>
              <option value="Administrator">Administrator</option>
              <option value="Content Manager">Content Manager</option>
              <option value="Sale Staff">Sale Staff</option>
            </select>
          </div>

          {/* cụm thông tin trạng thái với toggle ui */}
          <div className="um-form-group">
            <label>{mode === "view" ? "Status" : "Account Status"}</label>
            <div className="um-modal-status-flex">
              <div
                className={`um-modal-switch ${formData.status === "Active" ? "on" : ""} ${isViewOnly ? "disabled" : ""}`}
                onClick={handleToggleStatus}
              >
                <div className="um-modal-switch-handle"></div>
              </div>
              <span className="um-modal-status-text">{formData.status}</span>
            </div>
          </div>

          {/* cụm nút */}
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
}
