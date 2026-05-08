// imports
import { useState, useRef, useEffect } from "react";
import "./UserModal.css";
import { ChevronDownSmallIcon } from "../../../../assets/icons/UserManagementIcons";

// types
export interface User {
  id: string;
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
  phone: string;
  password?: string;
  role: string;
  department: string;
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

// helpers
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
  const [hasOpened, setHasOpened] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div
      className={`um-modal-custom-dropdown ${disabled ? "disabled" : ""}`}
      ref={ref}
    >
      <div
        className={`um-modal-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        {selectedOption ? (
          <span>{selectedOption.label}</span>
        ) : (
          <span className="placeholder">{placeholder || "Select..."}</span>
        )}
        <ChevronDownSmallIcon
          className={`um-modal-dropdown-arrow ${isOpen ? "open" : ""}`}
        />
      </div>
      <div
        className={`um-modal-dropdown-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`um-modal-dropdown-option ${value === opt.value ? "selected" : ""}`}
            onClick={() => {
              onChange(name, opt.value);
              setIsOpen(false);
            }}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// component wrapper
export default function UserModal(props: UserModalProps) {
  if (!props.isOpen) return null;
  const componentKey =
    props.mode === "add" ? "add-new" : props.initialData?.id || "modal";
  return <ModalContent key={componentKey} {...props} />;
}

// sub-component
function ModalContent({
  mode,
  initialData,
  dynamicRoleOptions,
  dynamicDeptOptions,
  onClose,
  onSubmit,
}: Omit<UserModalProps, "isOpen">) {
  // Khởi tạo state
  const [formData, setFormData] = useState<UserFormData>(() => {
    if ((mode === "edit" || mode === "view") && initialData) {
      return {
        name: initialData.name || "",
        email: initialData.email || "",
        phone: initialData.phone || "",
        department: initialData.department || "",
        password: mode === "view" ? "••••••••" : "",
        role: initialData.role || "",
        status: initialData.status || "Active",
      };
    }

    return {
      name: "",
      email: "",
      phone: "",
      department: "",
      password: "",
      role: "",
      status: "Active",
    };
  });

  const isViewOnly = mode === "view";

  // handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggleStatus = () => {
    if (isViewOnly) return;
    setFormData((prev) => ({
      ...prev,
      status: prev.status === "Active" ? "Inactive" : "Active",
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) {
      onClose();
      return;
    }
    onSubmit(formData);
  };

  // render
  return (
    <div
      className="um-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="um-modal-box">
        <h2 className="um-modal-title">
          {mode === "add"
            ? "Create User"
            : mode === "edit"
              ? "Edit User"
              : "View User Details"}
        </h2>
        <form className="um-modal-form" onSubmit={handleSubmit}>
          <div className="um-form-group">
            <label>
              Name {mode === "add" && <span className="req">*</span>}
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={isViewOnly}
              placeholder="Ví dụ: Trần Văn A"
              required={mode === "add"}
            />
          </div>

          <div className="um-form-group">
            <label>
              Email Address {mode === "add" && <span className="req">*</span>}
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={isViewOnly || mode === "edit"}
              placeholder="admin@hnodyssey.com"
              required={mode === "add"}
            />
          </div>

          <div className="um-form-row">
            <div className="um-form-group">
              <label>Phone Number</label>
              <input
                name="phone"
                type="text"
                value={formData.phone}
                onChange={handleChange}
                disabled={isViewOnly}
                placeholder="09..."
              />
            </div>

            <div className="um-form-group">
              <label>
                Password {mode === "add" && <span className="req">*</span>}
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                disabled={isViewOnly}
                placeholder={
                  mode === "add"
                    ? "Ít nhất 8 ký tự, có hoa, thường, số"
                    : isViewOnly
                      ? "••••••••"
                      : "Để trống nếu giữ nguyên mật khẩu"
                }
                required={mode === "add"}
              />
            </div>
          </div>

          <div className="um-form-row">
            <div className="um-form-group">
              <label>
                Role {mode === "add" && <span className="req">*</span>}
              </label>
              <CustomModalSelect
                name="role"
                value={formData.role}
                options={dynamicRoleOptions}
                onChange={handleSelectChange}
                disabled={isViewOnly}
                placeholder="Select Role"
              />
            </div>
            <div className="um-form-group">
              <label>
                Department {mode === "add" && <span className="req">*</span>}
              </label>
              <CustomModalSelect
                name="department"
                value={formData.department}
                options={dynamicDeptOptions}
                onChange={handleSelectChange}
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
