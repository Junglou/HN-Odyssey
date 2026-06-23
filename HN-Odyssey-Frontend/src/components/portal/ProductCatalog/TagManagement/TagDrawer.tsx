import { useState, useRef, useEffect } from "react";
import "./TagDrawer.css";

// icon
import { ArrowLeftIcon } from "../../../../assets/icons/TagManagementIcons";
import { ChevronDownSmallIcon } from "../../../../assets/icons/OrderManagementIcons";

import type {
  Tag,
  TagFormData,
} from "../../../../hooks/portal/ProductCatalog/TagManagement/useTagManagement";

interface TagDrawerProps {
  isOpen: boolean;
  mode: "add" | "edit";
  initialData: Tag | null;
  onClose: () => void;
  onSubmit: (data: TagFormData) => void;
}

// Bảng màu chuẩn
const COLOR_SWATCHES = [
  "#111827",
  "#374151",
  "#6B7280",
  "#E5E7EB",
  "#FFFFFF",
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
];

export default function TagDrawer(props: TagDrawerProps) {
  if (!props.isOpen) return null;

  const formKey = props.initialData?._id || "new-tag";

  return <TagDrawerContent key={formKey} {...props} />;
}

// component
function TagDrawerContent({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}: TagDrawerProps) {
  const [formData, setFormData] = useState<TagFormData>(() => {
    if (mode === "edit" && initialData) {
      return {
        name: initialData.name,
        description: initialData.description,
        scope: initialData.scope,
        bg_color: initialData.bg_color,
        text_color: initialData.text_color,
      };
    }
    return {
      name: "",
      description: "",
      scope: "PRODUCT",
      bg_color: "#E0E0E0",
      text_color: "#333333",
    };
  });

  // dropdown states
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasDropdownOpened, setHasDropdownOpened] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // color dropdown states
  const [isBgDropdownOpen, setIsBgDropdownOpen] = useState(false);
  const [isTextDropdownOpen, setIsTextDropdownOpen] = useState(false);
  const bgDropdownRef = useRef<HTMLDivElement>(null);
  const textDropdownRef = useRef<HTMLDivElement>(null);

  // validation states
  const [nameError, setNameError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  // close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsDropdownOpen(false);
      }
      if (bgDropdownRef.current && !bgDropdownRef.current.contains(target)) {
        setIsBgDropdownOpen(false);
      }
      if (
        textDropdownRef.current &&
        !textDropdownRef.current.contains(target)
      ) {
        setIsTextDropdownOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <>
      {/* overlay */}
      <div className="td-overlay" onClick={onClose}></div>

      <div className={`td-container ${isOpen ? "open" : ""}`}>
        <div className="td-header">
          <button
            type="button"
            className="td-back-btn"
            onClick={(e) => {
              onClose();
              e.currentTarget.blur();
            }}
            aria-label="Close drawer"
          >
            <ArrowLeftIcon />
          </button>
          <h2 className="td-title">
            {mode === "add" ? "Add Tag" : "Edit Tag"}
          </h2>
          <div style={{ width: "24px" }}></div>
        </div>

        <div className="td-body">
          <div className="td-form-group">
            <label>
              Tag Name <span className="td-required">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              className={nameError ? "td-input-error" : ""}
              placeholder="e.g. Summer Collection"
              value={formData.name}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, name: e.target.value }));
                if (nameError) setNameError("");
              }}
            />
            {nameError && <span className="td-error-message">{nameError}</span>}
          </div>

          <div className="td-form-group">
            <label>Description</label>
            <textarea
              placeholder="Mô tả ngắn về nhãn này..."
              rows={4}
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            ></textarea>
          </div>

          <div className="td-form-group">
            <label>Scope</label>
            {/* Custom Dropdown */}
            <div className="td-custom-dropdown" ref={dropdownRef}>
              <div
                className={`td-dropdown-trigger ${isDropdownOpen ? "active" : ""}`}
                onClick={() => {
                  setIsDropdownOpen(!isDropdownOpen);
                  if (!hasDropdownOpened) setHasDropdownOpened(true);
                }}
              >
                <span>{formData.scope === "PRODUCT" ? "Product" : "Blog"}</span>
                <div
                  className={`td-dropdown-arrow ${isDropdownOpen ? "open" : ""}`}
                >
                  <ChevronDownSmallIcon />
                </div>
              </div>

              <div
                className={`td-dropdown-options ${
                  isDropdownOpen ? "open" : hasDropdownOpened ? "closed" : ""
                }`}
              >
                <div
                  className={`td-dropdown-option ${
                    formData.scope === "PRODUCT" ? "selected" : ""
                  }`}
                  onClick={() => {
                    setFormData({ ...formData, scope: "PRODUCT" });
                    setIsDropdownOpen(false);
                  }}
                >
                  Product
                </div>
                <div
                  className={`td-dropdown-option ${
                    formData.scope === "BLOG" ? "selected" : ""
                  }`}
                  onClick={() => {
                    setFormData({ ...formData, scope: "BLOG" });
                    setIsDropdownOpen(false);
                  }}
                >
                  Blog
                </div>
              </div>
            </div>
          </div>

          <div className="td-color-group">
            {/* Custom Dropdown: Background Color */}
            <div className="td-form-group td-color-item" ref={bgDropdownRef}>
              <label>Background Color</label>
              <div
                className={`td-color-trigger ${isBgDropdownOpen ? "active" : ""}`}
                onClick={() => {
                  setIsBgDropdownOpen(!isBgDropdownOpen);
                  setIsTextDropdownOpen(false); // Đóng menu kia nếu đang mở
                }}
              >
                <div
                  className="td-color-preview"
                  style={{ backgroundColor: formData.bg_color }}
                ></div>
                <span className="td-color-hex">{formData.bg_color}</span>
              </div>

              {isBgDropdownOpen && (
                <div className="td-color-menu">
                  <div className="td-color-swatches">
                    {COLOR_SWATCHES.map((color) => (
                      <div
                        key={color}
                        className="td-color-swatch-item"
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          setFormData({ ...formData, bg_color: color });
                          setIsBgDropdownOpen(false);
                        }}
                      ></div>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="td-input td-color-hex-input"
                    value={formData.bg_color}
                    onChange={(e) =>
                      setFormData({ ...formData, bg_color: e.target.value })
                    }
                    placeholder="#HEX"
                  />
                </div>
              )}
            </div>

            {/* Custom Dropdown: Text Color */}
            <div className="td-form-group td-color-item" ref={textDropdownRef}>
              <label>Text Color</label>
              <div
                className={`td-color-trigger ${isTextDropdownOpen ? "active" : ""}`}
                onClick={() => {
                  setIsTextDropdownOpen(!isTextDropdownOpen);
                  setIsBgDropdownOpen(false);
                }}
              >
                <div
                  className="td-color-preview"
                  style={{ backgroundColor: formData.text_color }}
                ></div>
                <span className="td-color-hex">{formData.text_color}</span>
              </div>

              {isTextDropdownOpen && (
                <div className="td-color-menu">
                  <div className="td-color-swatches">
                    {COLOR_SWATCHES.map((color) => (
                      <div
                        key={color}
                        className="td-color-swatch-item"
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          setFormData({ ...formData, text_color: color });
                          setIsTextDropdownOpen(false);
                        }}
                      ></div>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="td-input td-color-hex-input"
                    value={formData.text_color}
                    onChange={(e) =>
                      setFormData({ ...formData, text_color: e.target.value })
                    }
                    placeholder="#HEX"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="td-footer">
          <button
            type="button"
            className="td-btn-cancel"
            onClick={(e) => {
              onClose();
              e.currentTarget.blur();
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="td-btn-submit"
            onClick={(e) => {
              if (!formData.name.trim()) {
                setNameError("Tag Name is required!");
                nameInputRef.current?.focus();
                return;
              }
              onSubmit(formData);
              e.currentTarget.blur();
            }}
          >
            {mode === "add" ? "Create Tag" : "Save Tag"}
          </button>
        </div>
      </div>
    </>
  );
}
