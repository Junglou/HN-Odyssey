import { useState, useEffect } from "react";
import "./VariantDrawer.css";

import {
  BackArrowIcon,
  CleanTrashIcon,
} from "../../../../assets/icons/VariantManagementIcons";

import type {
  Attribute,
  AttributeFormData,
  AttributeValue,
} from "../../../../hooks/portal/ProductCatalog/VariantManagement/useVariantManagement";

interface VariantDrawerProps {
  isOpen: boolean;
  mode: "add" | "edit";
  initialData: Attribute | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: AttributeFormData) => void;
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
      newValues[index] = { ...newValues[index], [field]: val };

      if (field === "label" && !newValues[index].value) {
        newValues[index].value = generateSlug(val);
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
            <span
              style={{
                fontSize: "12px",
                color: "#666",
                marginTop: "4px",
                display: "block",
              }}
            >
              Letters, numbers, and hyphens only.
            </span>
          </div>

          <div className="vd-form-group">
            <label className="vd-label">Display Type</label>
            <select
              className="vd-input"
              value={formData.display_type}
              onChange={(e) =>
                setFormData({ ...formData, display_type: e.target.value })
              }
              disabled={isSubmitting}
            >
              <option value="BUTTON">BUTTON (Text Swatch)</option>
              <option value="COLOR">COLOR (Color Swatch)</option>
              <option value="DROPDOWN">DROPDOWN (Select List)</option>
            </select>
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
            <div
              className="vd-values-container"
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {formData.values.map((v, idx) => (
                <div
                  key={idx}
                  className="vd-value-row"
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
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
                      style={{
                        width: "40px",
                        height: "40px",
                        padding: "2px",
                        cursor: "pointer",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                      }}
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
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "red",
                    }}
                    onClick={() => handleRemoveValue(idx)}
                    disabled={isSubmitting}
                  >
                    <CleanTrashIcon />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="vd-btn-submit"
                style={{
                  background: "transparent",
                  color: "#2563eb",
                  border: "1px dashed #2563eb",
                  marginTop: "8px",
                }}
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
            style={{
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
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
