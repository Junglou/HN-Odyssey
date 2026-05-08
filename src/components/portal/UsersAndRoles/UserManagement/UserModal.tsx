// imports
import { useState, useRef, useEffect } from "react";
import "./UserModal.css";
import { ChevronDownSmallIcon } from "../../../../assets/icons/UserManagementIcons";

// types
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

interface DropdownOption {
  label: string;
  value: string;
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

// constants
const MODAL_ROLE_OPTIONS: DropdownOption[] = [
  { label: "Administrator", value: "Administrator" },
  { label: "Content Manager", value: "Content Manager" },
  { label: "Sale Staff", value: "Sale Staff" },
];

// component
export default function UserModal(props: UserModalProps) {
  // dùng key để ép React reset lại component mỗi khi mở, loại bỏ hoàn toàn useEffect
  if (!props.isOpen) return null;
  const componentKey =
    props.mode === "add" ? "add-new" : props.initialData?.id || "modal";
  return <ModalContent key={componentKey} {...props} />;
}

// sub-component
function ModalContent({
  mode,
  initialData,
  onClose,
  onSubmit,
}: Omit<UserModalProps, "isOpen">) {
  // khởi tạo state trực tiếp
  const [formData, setFormData] = useState<UserFormData>(() => {
    if ((mode === "edit" || mode === "view") && initialData) {
      return {
        name: initialData.name,
        email: initialData.email,
        username: initialData.email.split("@")[0],
        password: "",
        role: initialData.role,
        status: initialData.status,
      };
    }
    return {
      name: "",
      email: "",
      username: "",
      password: "",
      role: "",
      status: "Active",
    };
  });

  const isViewOnly = mode === "view";

  // handlers
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
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
              Name <span className="req">*</span>
            </label>
            <input
              type="text"
              name="name"
              placeholder="e.g. John Doe"
              value={formData.name}
              onChange={handleChange}
              disabled={isViewOnly}
              required
            />
          </div>

          <div className="um-form-group">
            <label>
              Email Address <span className="req">*</span>
            </label>
            <input
              type="email"
              name="email"
              placeholder="e.g. john@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={isViewOnly}
              required
            />
          </div>

          <div className="um-form-group">
            <label>
              Username <span className="req">*</span>
            </label>
            <input
              type="text"
              name="username"
              placeholder="e.g. johndoe123"
              value={formData.username}
              onChange={handleChange}
              disabled={isViewOnly}
              required
            />
          </div>

          {mode !== "view" && (
            <div className="um-form-group">
              <label>
                Password{" "}
                {mode === "edit" ? (
                  "(Leave blank to keep current)"
                ) : (
                  <span className="req">*</span>
                )}
              </label>
              <input
                type="password"
                name="password"
                placeholder="Enter strong password"
                value={formData.password}
                onChange={handleChange}
                required={mode === "add"}
              />
            </div>
          )}

          <div className="um-form-group">
            <label>
              Role <span className="req">*</span>
            </label>
            <CustomModalSelect
              name="role"
              value={formData.role}
              options={MODAL_ROLE_OPTIONS}
              onChange={handleSelectChange}
              disabled={isViewOnly}
              placeholder="Select role"
            />
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
