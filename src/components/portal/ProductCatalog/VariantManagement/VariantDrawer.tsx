import { useState, useEffect, useRef } from "react";
import "./VariantDrawer.css";

import { ChevronDownIcon } from "../../../../assets/icons/HeaderIcons";
import {
  BackArrowIcon,
  CleanTrashIcon,
} from "../../../../assets/icons/VariantManagementIcons";

import type {
  Attribute,
  AttributeFormData,
  AttributeValue,
} from "../../../../hooks/portal/ProductCatalog/VariantManagement/useVariantManagement";

// options
const DISPLAY_TYPE_OPTIONS = [
  { value: "BUTTON", label: "BUTTON (Text Swatch)" },
  { value: "COLOR", label: "COLOR (Color Swatch)" },
  { value: "DROPDOWN", label: "DROPDOWN (Select List)" },
];

interface VariantDrawerProps {
  isOpen: boolean;
  mode: "add" | "edit";
  initialData: Attribute | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: AttributeFormData) => void;
}

// custom dropdown
function CustomDropdown({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedOption =
    options.find((opt) => opt.value === value) || options[0];

  return (
    <div className="vd-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`vd-dropdown-btn ${isOpen ? "open" : ""}`}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
        disabled={disabled}
      >
        <span className="vd-dropdown-label">{selectedOption.label}</span>
        <ChevronDownIcon className="vd-dropdown-icon" />
      </button>

      <div
        className={`vd-dropdown-menu ${
          isOpen ? "open" : hasOpened ? "close" : ""
        }`}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`vd-dropdown-item ${
              value === opt.value ? "active" : ""
            }`}
            onClick={() => {
              onChange(opt.value);
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

export default function VariantDrawer(props: VariantDrawerProps) {
  if (!props.isOpen) return null;
  const formKey = props.initialData?.id || "new-attr";
  return <VariantDrawerContent key={formKey} {...props} />;
}

function VariantDrawerContent({
  mode,
  initialData,
  isSubmitting,
  onClose,
  onSubmit,
}: Omit<VariantDrawerProps, "isOpen">) {
  // states
  const [formData, setFormData] = useState<AttributeFormData>(() => {
    if (mode === "edit" && initialData) {
      return {
        name: initialData.name,
        code: initialData.code,
        display_type: initialData.display_type,
        description: initialData.description || "",
        values: initialData.values,
        is_active: initialData.is_active,
      };
    }
    return {
      name: "",
      code: "",
      display_type: "BUTTON",
      description: "",
      values: [],
      is_active: true,
    };
  });

  // effects
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, isSubmitting]);

  // helper
  const generateSlug = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^\w-]/g, "");
  };

  // handle
  const handleNameChange = (val: string) => {
    setFormData((prev) => ({
      ...prev,
      name: val,
      code: mode === "add" ? generateSlug(val) : prev.code,
    }));
  };

  const handleAddValue = () => {
    setFormData((prev) => ({
      ...prev,
      values: [...prev.values, { label: "", value: "", meta: "" }],
    }));
  };

  const handleUpdateValue = (
    index: number,
    field: keyof AttributeValue,
    val: string,
  ) => {
    setFormData((prev) => {
      const newValues = [...prev.values];
      const oldLabel = prev.values[index].label;
      const oldValue = prev.values[index].value;

      newValues[index] = { ...newValues[index], [field]: val };

      if (field === "label") {
        if (!oldValue || oldValue === generateSlug(oldLabel)) {
          newValues[index].value = generateSlug(val);
        }
      }

      return { ...prev, values: newValues };
    });
  };

  const handleRemoveValue = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      values: prev.values.filter((_, i) => i !== index),
    }));
  };

  return (
    <>
      <div
        className="vd-overlay"
        onClick={() => !isSubmitting && onClose()}
      ></div>
      <div className="vd-container">
        <div className="vd-header">
          <button
            type="button"
            className="vd-back-btn"
            onClick={() => !isSubmitting && onClose()}
            disabled={isSubmitting}
          >
            <BackArrowIcon />
          </button>
          <h2 className="vd-title">
            {mode === "add" ? "Add New Attribute" : "Edit Attribute"}
          </h2>
        </div>

        <div className="vd-body">
          <div className="vd-form-group">
            <label className="vd-label">Attribute Name</label>
            <input
              type="text"
              className="vd-input"
              placeholder="e.g., Color, Size"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="vd-form-group">
            <label className="vd-label">Attribute Code (Unique)</label>
            <input
              type="text"
              className="vd-input"
              placeholder="e.g., color, size"
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value })
              }
              disabled={isSubmitting || mode === "edit"}
            />
            <span className="vd-hint-text">
              Letters, numbers, and hyphens only.
            </span>
          </div>

          <div className="vd-form-group">
            <label className="vd-label">Display Type</label>
            <CustomDropdown
              value={formData.display_type}
              options={DISPLAY_TYPE_OPTIONS}
              onChange={(val) =>
                setFormData({ ...formData, display_type: val })
              }
              disabled={isSubmitting}
            />
          </div>

          <div className="vd-form-group">
            <label className="vd-label">Description</label>
            <input
              type="text"
              className="vd-input"
              placeholder="Internal description..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              disabled={isSubmitting}
            />
          </div>

          <div className="vd-form-group">
            <label className="vd-label">Attribute Values</label>
            <div className="vd-values-container">
              {formData.values.map((v, idx) => (
                <div key={idx} className="vd-value-row">
                  <input
                    type="text"
                    className="vd-input"
                    placeholder="Label"
                    value={v.label}
                    onChange={(e) =>
                      handleUpdateValue(idx, "label", e.target.value)
                    }
                    disabled={isSubmitting}
                  />
                  <input
                    type="text"
                    className="vd-input"
                    placeholder="Value"
                    value={v.value}
                    onChange={(e) =>
                      handleUpdateValue(idx, "value", e.target.value)
                    }
                    disabled={isSubmitting}
                  />
                  {formData.display_type === "COLOR" && (
                    <input
                      type="color"
                      className="vd-color-picker"
                      value={v.meta || "#000000"}
                      onChange={(e) =>
                        handleUpdateValue(idx, "meta", e.target.value)
                      }
                      disabled={isSubmitting}
                      title="Pick color"
                    />
                  )}
                  <button
                    type="button"
                    className="vd-btn-remove-val"
                    onClick={() => handleRemoveValue(idx)}
                    disabled={isSubmitting}
                  >
                    <CleanTrashIcon />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="vd-btn-add-val"
                onClick={handleAddValue}
                disabled={isSubmitting}
              >
                + Add Value
              </button>
            </div>
          </div>

          <div className="vd-form-group">
            <label className="vd-label">Status</label>
            <div className="vd-status-toggle-wrapper">
              <button
                type="button"
                className={`vd-toggle-switch ${formData.is_active ? "on" : ""}`}
                onClick={() => {
                  if (!isSubmitting) {
                    setFormData((prev) => ({
                      ...prev,
                      is_active: !prev.is_active,
                    }));
                  }
                }}
                disabled={isSubmitting}
              ></button>
              <span className="vd-status-label">
                {formData.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        <div className="vd-footer">
          <button
            type="button"
            className="vd-btn-cancel"
            onClick={() => !isSubmitting && onClose()}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="vd-btn-submit"
            onClick={() => !isSubmitting && onSubmit(formData)}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Saving..."
              : mode === "add"
                ? "Create Attribute"
                : "Save Attribute"}
          </button>
        </div>
      </div>
    </>
  );
}
