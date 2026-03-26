import { useState, useRef, useEffect } from "react";
import "./UserModal.css";
import { ChevronDownSmallIcon } from "../../../../assets/icons/UserManagementIcons";

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

// --- Component Custom Select dành riêng cho Modal ---
interface DropdownOption {
  label: string;
  value: string;
}

function CustomModalSelect({
  name,
  value,
  options,
  onChange,
  disabled,
  placeholder,
}: {
  name: string;
  value: string;
  options: DropdownOption[];
  onChange: (name: string, value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Xử lý click ra ngoài để đóng menu
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

  const selectedLabel = options.find((opt) => opt.value === value)?.label;

  return (
    <div
      className={`um-modal-custom-dropdown ${isOpen ? "is-open" : ""} ${disabled ? "disabled" : ""}`}
      ref={dropdownRef}
    >
      <div
        className={`um-modal-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={!selectedLabel ? "placeholder" : ""}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDownSmallIcon
          className={`um-modal-dropdown-arrow ${isOpen ? "open" : ""}`}
          style={{ color: disabled ? "#9ca3af" : "#333" }}
        />
      </div>
      {isOpen && !disabled && (
        <div className="um-modal-dropdown-options">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`um-modal-dropdown-item ${value === opt.value ? "selected" : ""}`}
              onClick={() => {
                onChange(name, opt.value);
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

// Data mock cho Role
const ROLE_OPTIONS: DropdownOption[] = [
  { label: "Administrator", value: "Administrator" },
  { label: "Content Manager", value: "Content Manager" },
  { label: "Sale Staff", value: "Sale Staff" },
];

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

  // update state theo input text thường
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // update state riêng cho custom dropdown
  const handleCustomSelectChange = (name: string, value: string) => {
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
            {/* Thay thế thẻ select gốc bằng CustomModalSelect */}
            <CustomModalSelect
              name="role"
              value={formData.role}
              options={ROLE_OPTIONS}
              onChange={handleCustomSelectChange}
              disabled={isViewOnly}
              placeholder="Select Role"
            />
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
