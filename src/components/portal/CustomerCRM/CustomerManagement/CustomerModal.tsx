import { useState, useEffect, useRef } from "react";
import "./CustomerModal.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import { ChevronDownSmallIcon } from "../../../../assets/icons/CustomerManagementIcons";

import type {
  CustomerRecord,
  CustomerFormData,
  CustomerStatus,
  ReviewAccessStatus,
} from "../../../../hooks/portal/CustomerCRM/CustomerManagement/useCustomerManagement";

export interface CustomerModalProps {
  isOpen: boolean;
  mode: "add" | "edit" | "view";
  initialData: CustomerRecord | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: CustomerFormData) => void;
}

// component modal
export default function CustomerModal(props: CustomerModalProps) {
  if (!props.isOpen) return null;
  const modalKey = props.initialData?.id || "new-customer";
  return <CustomerModalContent key={modalKey} {...props} />;
}

function CustomerModalContent({
  mode,
  initialData,
  isSubmitting,
  onClose,
  onSubmit,
}: Omit<CustomerModalProps, "isOpen">) {
  const [formData, setFormData] = useState<CustomerFormData>({
    fullName: initialData?.fullName || "",
    email: initialData?.email || "",
    username: initialData?.username || "",
    password: "",
    customerType: "Standard",
    phone: initialData?.phone || "",
    status: initialData?.status || "Active",
    reviewAccess: initialData?.reviewAccess || "Allowed",
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // State và ref cho custom dropdown Customer Type
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);
  useClickOutside(typeRef, () => setIsTypeOpen(false));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isSubmitting]);

  const handleSave = () => {
    if (isSubmitting) return;

    const newErrors: { [key: string]: string } = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Full Name is required";
    if (!formData.email.trim()) newErrors.email = "Email Address is required";
    if (!formData.username.trim()) newErrors.username = "Username is required";
    if (!formData.customerType.trim())
      newErrors.customerType = "Customer Type is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone Number is required";
    if (mode === "add" && !formData.password?.trim()) {
      newErrors.password = "Password is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onSubmit(formData);
  };

  const updateField = (field: keyof CustomerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const toggleStatus = () => {
    if (isSubmitting) return;
    if (formData.status === "Locked") return;

    const newStatus: CustomerStatus =
      formData.status === "Active" ? "Inactive" : "Active";
    setFormData((prev) => ({ ...prev, status: newStatus }));
  };

  const toggleReviewAccess = () => {
    if (isSubmitting) return;
    const newAccess: ReviewAccessStatus =
      formData.reviewAccess === "Allowed" ? "Restricted" : "Allowed";
    setFormData((prev) => ({ ...prev, reviewAccess: newAccess }));
  };

  return (
    <div
      className="crm-modal-overlay"
      onClick={!isSubmitting ? onClose : undefined}
    >
      <div className="crm-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="crm-modal-header">
          <h2 className="crm-modal-title">
            {mode === "add" ? "Add Customer" : "Edit Customer"}
          </h2>
          <button
            type="button"
            className="crm-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="crm-modal-body">
          <div className="crm-form-group crm-full-width">
            <label>
              Full Name <span className="crm-required">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter full name"
              value={formData.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              disabled={isSubmitting}
              className={errors.fullName ? "crm-input-error" : ""}
            />
            {errors.fullName && (
              <span className="crm-error-text">{errors.fullName}</span>
            )}
          </div>

          <div className="crm-form-group crm-full-width">
            <label>
              Email Address <span className="crm-required">*</span>
            </label>
            <input
              type="email"
              placeholder="Enter email"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              disabled={isSubmitting}
              className={errors.email ? "crm-input-error" : ""}
            />
            {errors.email && (
              <span className="crm-error-text">{errors.email}</span>
            )}
          </div>

          <div className="crm-grid-2">
            <div className="crm-form-group">
              <label>
                Username <span className="crm-required">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter username"
                value={formData.username}
                onChange={(e) => updateField("username", e.target.value)}
                disabled={isSubmitting}
                className={errors.username ? "crm-input-error" : ""}
              />
              {errors.username && (
                <span className="crm-error-text">{errors.username}</span>
              )}
            </div>

            <div className="crm-form-group">
              <label>
                Password{" "}
                {mode === "add" && <span className="crm-required">*</span>}
              </label>
              <input
                type="password"
                placeholder={
                  mode === "edit"
                    ? "Leave blank to keep current"
                    : "Enter password"
                }
                value={formData.password}
                onChange={(e) => updateField("password", e.target.value)}
                disabled={isSubmitting}
                className={errors.password ? "crm-input-error" : ""}
              />
              {errors.password && (
                <span className="crm-error-text">{errors.password}</span>
              )}
            </div>
          </div>

          <div className="crm-form-group crm-full-width" ref={typeRef}>
            <label>
              Customer Type <span className="crm-required">*</span>
            </label>
            <div className="crm-modal-dropdown-wrapper">
              <div
                className={`crm-modal-select-trigger ${isSubmitting ? "disabled" : ""} ${errors.customerType ? "error" : ""}`}
                onClick={() => {
                  if (!isSubmitting) setIsTypeOpen(!isTypeOpen);
                }}
              >
                <span>{formData.customerType || "Select Type"}</span>
                <ChevronDownSmallIcon className={isTypeOpen ? "open" : ""} />
              </div>
              {isTypeOpen && !isSubmitting && (
                <div className="crm-modal-dropdown-options">
                  {(
                    [
                      "Standard",
                      "Trade-in Customer",
                      "Silver",
                      "Gold",
                      "VIP",
                    ] as const
                  ).map((opt) => (
                    <div
                      key={opt}
                      className={`crm-modal-dropdown-option ${formData.customerType === opt ? "active" : ""}`}
                      onClick={() => {
                        updateField("customerType", opt);
                        setIsTypeOpen(false);
                      }}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {errors.customerType && (
              <span className="crm-error-text">{errors.customerType}</span>
            )}
          </div>

          <div className="crm-form-group crm-full-width">
            <label>
              Phone Number <span className="crm-required">*</span>
            </label>
            <input
              type="text"
              placeholder="(+84) XXXX-XXXX-XX"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              disabled={isSubmitting}
              className={errors.phone ? "crm-input-error" : ""}
            />
            {errors.phone && (
              <span className="crm-error-text">{errors.phone}</span>
            )}
          </div>

          <div className="crm-form-group crm-full-width">
            <label>Account Status</label>
            <div className="crm-status-toggle-wrapper">
              <button
                type="button"
                role="switch"
                aria-checked={formData.status === "Active"}
                className={`crm-toggle-switch ${formData.status === "Active" ? "on" : ""}`}
                onClick={toggleStatus}
                disabled={isSubmitting || formData.status === "Locked"}
              ></button>
              <span className="crm-status-label">{formData.status}</span>
            </div>
          </div>

          <div className="crm-form-group crm-full-width">
            <label>Review Access</label>
            <div className="crm-status-toggle-wrapper">
              <button
                type="button"
                role="switch"
                aria-checked={formData.reviewAccess === "Allowed"}
                className={`crm-toggle-switch ${formData.reviewAccess === "Allowed" ? "on" : ""}`}
                onClick={toggleReviewAccess}
                disabled={isSubmitting}
              ></button>
              <span className="crm-status-label">{formData.reviewAccess}</span>
            </div>
          </div>
        </div>

        <div className="crm-modal-footer">
          <button
            type="button"
            className="crm-btn-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="crm-btn-submit"
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Saving..."
              : mode === "add"
                ? "Create User"
                : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
