import { useState, useEffect } from "react";
import "./VariantDrawer.css";

import { BackArrowIcon } from "../../../../assets/icons/VariantManagementIcons";

import type {
  Variant,
  VariantFormData,
} from "../../../../hooks/portal/ProductCatalog/VariantManagement/useVariantManagement";

interface VariantDrawerProps {
  isOpen: boolean;
  mode: "add" | "edit";
  initialData: Variant | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: VariantFormData) => void;
}

// component drawer chính
export default function VariantDrawer(props: VariantDrawerProps) {
  if (!props.isOpen) return null;

  const formKey = props.initialData?.id || "new-variant";
  return <VariantDrawerContent key={formKey} {...props} />;
}

// component drawer
function VariantDrawerContent({
  mode,
  initialData,
  isSubmitting,
  onClose,
  onSubmit,
}: Omit<VariantDrawerProps, "isOpen">) {
  // state quản lý form, khởi tạo dựa trên mode và initialData
  const [formData, setFormData] = useState<VariantFormData>(() => {
    if (mode === "edit" && initialData) {
      return {
        name: initialData.name,
        values: initialData.values.join(", "),
        status: initialData.status,
      };
    }
    return {
      name: "",
      values: "",
      status: "Active",
    };
  });
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isSubmitting]);

  return (
    <>
      <div
        className="vd-overlay"
        onClick={!isSubmitting ? onClose : undefined}
      ></div>
      <div
        className="vd-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="variant-drawer-title"
      >
        <div className="vd-header">
          <button
            type="button"
            className="vd-back-btn"
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            aria-label="Close drawer"
            disabled={isSubmitting}
          >
            <BackArrowIcon />
          </button>
          <h2 id="variant-drawer-title" className="vd-title">
            {mode === "add" ? "Add Variant" : "Edit Variant"}
          </h2>
          <div style={{ width: "24px" }}></div>
        </div>

        <div className="vd-body">
          <div className="vd-form-group">
            <label>
              Variant Name <span className="vd-required">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Summer Collection"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              disabled={isSubmitting}
            />
          </div>

          <div className="vd-form-group">
            <label>
              Variant Value <span className="vd-required">*</span>
            </label>
            <textarea
              placeholder="Small(S), Medium(M),..."
              rows={4}
              value={formData.values}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, values: e.target.value }))
              }
              disabled={isSubmitting}
            ></textarea>
          </div>

          <div className="vd-form-group">
            <label>Variant Status</label>
            <div className="vd-status-toggle-wrapper">
              <button
                type="button"
                role="switch"
                aria-checked={formData.status === "Active"}
                className={`vd-toggle-switch ${formData.status === "Active" ? "on" : ""}`}
                onClick={() => {
                  if (isSubmitting) return;
                  setFormData((prev) => ({
                    ...prev,
                    status: prev.status === "Active" ? "Inactive" : "Active",
                  }));
                }}
                disabled={isSubmitting}
              ></button>
              <span className="vd-status-label">{formData.status}</span>
            </div>
          </div>
        </div>

        <div className="vd-footer">
          <button
            type="button"
            className="vd-btn-cancel"
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="vd-btn-submit"
            onClick={() => {
              if (!isSubmitting) onSubmit(formData);
            }}
            disabled={isSubmitting}
            style={{
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting
              ? "Saving..."
              : mode === "add"
                ? "Create Variant"
                : "Save Variant"}
          </button>
        </div>
      </div>
    </>
  );
}
