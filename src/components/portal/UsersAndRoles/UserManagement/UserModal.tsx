import { useState, useRef, useEffect } from "react";
import "./UserModal.css";
import { ChevronDownSmallIcon } from "../../../../assets/icons/UserManagementIcons";

export interface User {
  id: string; // Chuyển sang string
  name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  status: string;
  lastLogin: string;
  selected: boolean;
}

export interface UserFormData {
  name: string;
  email: string;
  phone: string; // Đã đổi từ username sang phone
  password?: string;
  role: string;
  department: string; // Bổ sung theo Schema BE
  status: string;
}

interface DropdownOption {
  label: string;
  value: string;
}

interface UserModalProps {
  isOpen: boolean;
  mode: "add" | "edit" | "view";
  initialData: User | null;
  dynamicRoleOptions: DropdownOption[];
  dynamicDeptOptions: DropdownOption[];
  onClose: () => void;
  onSubmit: (data: UserFormData) => void;
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

export default function UserModal({
  isOpen,
  mode,
  initialData,
  dynamicRoleOptions,
  dynamicDeptOptions,
  onClose,
  onSubmit,
}: UserModalProps) {
  const [formData, setFormData] = useState<UserFormData>({
    name: initialData?.name || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    password: mode === "add" ? "" : "••••••••",
    role: initialData?.role || "",
    department: initialData?.department || "",
    status: initialData?.status || "Active",
  });

  const isViewOnly = mode === "view";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCustomSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.name ||
      !formData.email ||
      !formData.role ||
      !formData.phone ||
      !formData.department
    ) {
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
              placeholder="Ví dụ: Trần Văn A"
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
              placeholder="admin@hnodyssey.com"
              required
            />
          </div>

          <div className="um-form-row">
            <div className="um-form-group">
              <label>
                Phone Number <span className="req">*</span>
              </label>
              <input
                name="phone"
                type="text"
                value={formData.phone}
                onChange={handleInputChange}
                disabled={isViewOnly}
                placeholder="09..."
                required
              />
            </div>
            <div className="um-form-group">
              <label>
                Password {mode === "add" && <span className="req">*</span>}
              </label>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                disabled={isViewOnly}
                placeholder="Ít nhất 8 ký tự, có Hoa, thường, số"
                required={mode === "add"}
              />
            </div>
          </div>

          {/* Dùng Layout Grid cũ chia 2 Dropdown (Role & Dept) ra làm 2 cột tuyệt đẹp */}
          <div className="um-form-row">
            <div className="um-form-group">
              <label>
                Role <span className="req">*</span>
              </label>
              <CustomModalSelect
                name="role"
                value={formData.role}
                options={dynamicRoleOptions}
                onChange={handleCustomSelectChange}
                disabled={isViewOnly}
                placeholder="Select Role"
              />
            </div>
            <div className="um-form-group">
              <label>
                Department <span className="req">*</span>
              </label>
              <CustomModalSelect
                name="department"
                value={formData.department}
                options={dynamicDeptOptions}
                onChange={handleCustomSelectChange}
                disabled={isViewOnly}
                placeholder="Select Department"
              />
            </div>
          </div>

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
