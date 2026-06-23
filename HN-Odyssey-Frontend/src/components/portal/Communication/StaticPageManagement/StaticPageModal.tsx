import { useState, useRef, useEffect, type FormEvent } from "react";
import SunEditor from "suneditor-react";
import "suneditor/dist/css/suneditor.min.css";
import "./StaticPageModal.css";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
} from "../../../../assets/icons/StaticPageManagementIcons";
import type {
  StaticPageRecord,
  StaticPageFormData,
  PageType,
} from "../../../../hooks/portal/Communication/StaticPageManagement/useStaticPageManagement";

// helpers
function CustomSelect({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
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

  const selectedLabel =
    options.find((o) => o.value === value)?.label || "Choose category";

  return (
    <div className="sp-custom-select-wrapper" ref={ref}>
      <div
        className={`sp-custom-select-trigger ${isOpen ? "active" : ""} ${disabled ? "disabled" : ""}`}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        <span>{selectedLabel}</span>
        <div className={`sp-select-arrow ${isOpen ? "open" : ""}`}>
          <ChevronDownIcon />
        </div>
      </div>
      <div
        className={`sp-custom-select-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`sp-custom-select-option ${value === opt.value ? "selected" : ""}`}
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

// props
interface StaticPageModalProps {
  isOpen: boolean;
  mode: "add" | "edit" | "view";
  initialData: StaticPageRecord | null;
  onClose: () => void;
  onSubmit: (data: StaticPageFormData) => void;
}

// constants
const defaultFormData: StaticPageFormData = {
  title: "",
  slug: "",
  type: "",
  content: "",
  status: "Draft",
};

const PAGE_TYPE_OPTIONS = [
  { value: "About Us", label: "About Us" },
  { value: "Policy", label: "Policy" },
  { value: "FAQ", label: "FAQ" },
  { value: "Contact", label: "Contact" },
  { value: "Guide", label: "Guide" },
  { value: "Promotion", label: "Promotion" },
  { value: "Company News", label: "Company News" },
];

// component
export default function StaticPageModal(props: StaticPageModalProps) {
  if (!props.isOpen) return null;
  const componentKey = props.mode === "add" ? "add-new" : props.initialData?.id;
  return <ModalContent key={componentKey} {...props} />;
}

// sub-component
function ModalContent({
  mode,
  initialData,
  onClose,
  onSubmit,
}: Omit<StaticPageModalProps, "isOpen">) {
  const [formData, setFormData] = useState<StaticPageFormData>(() => {
    if ((mode === "edit" || mode === "view") && initialData) {
      return {
        title: initialData.title,
        slug: initialData.slug,
        type: initialData.type,
        content: initialData.content,
        status: initialData.status,
      };
    }
    return defaultFormData;
  });

  const isViewMode = mode === "view";
  const titleText =
    mode === "add"
      ? "Create Static Page"
      : mode === "edit"
        ? "Edit Static Page"
        : "Static Page Details";

  // handlers
  const handleChange = (field: keyof StaticPageFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }
    onSubmit(formData);
  };

  // Chuẩn hóa Slug đúng định dạng Backend
  const formatSlug = (text: string) => {
    let slug = text.toLowerCase();
    slug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Bỏ dấu tiếng Việt
    slug = slug.replace(/[đĐ]/g, "d");
    slug = slug.replace(/[^a-z0-9\s-]/g, ""); // Bỏ ký tự đặc biệt
    slug = slug.replace(/\s+/g, "-"); // Khoảng trắng thành gạch ngang
    slug = slug.replace(/-+/g, "-"); // Xóa gạch ngang liên tiếp
    slug = slug.replace(/^-+|-+$/g, ""); // Cắt gạch ngang thừa ở đầu và cuối
    return slug;
  };

  const handleSlugBlur = () => {
    const newSlug = formatSlug(formData.slug);
    handleChange("slug", newSlug);
  };

  const handleTitleBlur = () => {
    if (!formData.slug && formData.title) {
      handleChange("slug", formatSlug(formData.title));
    }
  };

  // render
  return (
    <>
      <div
        className="sp-modal-overlay"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      ></div>
      <div className="sp-modal-container">
        <form onSubmit={handleSubmit} className="sp-modal-form">
          <div className="sp-modal-header">
            <button
              type="button"
              className="sp-modal-back-btn"
              onClick={onClose}
            >
              <ArrowLeftIcon />
            </button>
            <h2 className="sp-modal-title">{titleText}</h2>
          </div>

          <div className="sp-modal-body">
            <div className="sp-form-group">
              <label className="sp-form-label">
                Page Title <span className="sp-required">*</span>
              </label>
              <input
                type="text"
                className="sp-form-input"
                placeholder="e.g. Privacy Policy"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                onBlur={handleTitleBlur}
                disabled={isViewMode}
              />
            </div>

            <div className="sp-form-group">
              <label className="sp-form-label">
                Page Slug / URL <span className="sp-required">*</span>
              </label>
              <input
                type="text"
                className="sp-form-input"
                placeholder="e.g. privacy-policy"
                value={formData.slug}
                onChange={(e) => handleChange("slug", e.target.value)}
                onBlur={handleSlugBlur}
                disabled={isViewMode || initialData?.isSystem}
              />
            </div>

            <div className="sp-form-group">
              <label className="sp-form-label">
                Page Type <span className="sp-required">*</span>
              </label>
              <CustomSelect
                value={formData.type}
                options={PAGE_TYPE_OPTIONS}
                onChange={(val) => handleChange("type", val as PageType)}
                disabled={isViewMode || initialData?.isSystem}
              />
            </div>

            {/* ĐÃ CHỈNH SỬA: Bỏ inline style, thêm class .sp-form-group-editor */}
            <div className="sp-form-group sp-form-group-editor">
              <label className="sp-form-label">
                Content <span className="sp-required">*</span>
              </label>

              <div
                className={`sp-suneditor-wrapper ${isViewMode ? "disabled" : ""}`}
              >
                <SunEditor
                  setContents={formData.content}
                  onChange={(content) => handleChange("content", content)}
                  disable={isViewMode}
                  setOptions={{
                    height: "350px",
                    resizingBar: false,
                    buttonList: [
                      ["undo", "redo"],
                      ["font", "fontSize", "formatBlock"],
                      [
                        "bold",
                        "underline",
                        "italic",
                        "strike",
                        "subscript",
                        "superscript",
                      ],
                      ["removeFormat"],
                      "/",
                      [
                        "fontColor",
                        "hiliteColor",
                        "outdent",
                        "indent",
                        "align",
                        "horizontalRule",
                        "list",
                        "table",
                      ],
                      [
                        "link",
                        "image",
                        "video",
                        "fullScreen",
                        "showBlocks",
                        "codeView",
                      ],
                    ],
                  }}
                />
              </div>

              <div className="sp-editor-footer">
                {initialData?.lastSaved
                  ? `Last saved: ${initialData.lastSaved}`
                  : "Not saved yet"}
              </div>
            </div>

            <div className="sp-status-section">
              <label className="sp-status-label">Status</label>
              <div className="sp-status-indicator">
                <span
                  className={`sp-status-badge ${formData.status === "Published" ? "published" : "draft"}`}
                >
                  {formData.status}
                </span>
              </div>
              <div className="sp-toggle-wrapper">
                <label className="sp-toggle-switch">
                  <input
                    type="checkbox"
                    className="sp-toggle-input"
                    checked={formData.status === "Published"}
                    onChange={(e) =>
                      handleChange(
                        "status",
                        e.target.checked ? "Published" : "Draft",
                      )
                    }
                    disabled={isViewMode}
                  />
                  <span className="sp-toggle-slider"></span>
                </label>
                <span className="sp-toggle-text">Draft / Publish</span>
              </div>
            </div>
          </div>

          <div className="sp-modal-footer">
            <div className="sp-footer-buttons">
              {!isViewMode && (
                <button type="submit" className="sp-btn-primary">
                  {mode === "add" ? "Create Page" : "Save Changes"}
                </button>
              )}
              <button
                type="button"
                className="sp-btn-secondary"
                onClick={onClose}
              >
                {isViewMode ? "Close" : "Cancel"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
