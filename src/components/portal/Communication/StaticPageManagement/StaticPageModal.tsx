import { useState, type FormEvent } from "react";
import SunEditor from "suneditor-react";
import "suneditor/dist/css/suneditor.min.css";
import "./StaticPageModal.css";
import { ArrowLeftIcon } from "../../../../assets/icons/StaticPageManagementIcons";
import type {
  StaticPageRecord,
  StaticPageFormData,
  PageType,
} from "../../../../hooks/portal/Communication/StaticPageManagement/useStaticPageManagement";

interface StaticPageModalProps {
  isOpen: boolean;
  mode: "add" | "edit" | "view";
  initialData: StaticPageRecord | null;
  onClose: () => void;
  onSubmit: (data: StaticPageFormData) => void;
}

const defaultFormData: StaticPageFormData = {
  title: "",
  slug: "",
  type: "",
  content: "",
  status: "Draft",
};

export default function StaticPageModal(props: StaticPageModalProps) {
  if (!props.isOpen) return null;
  const componentKey = props.mode === "add" ? "add-new" : props.initialData?.id;
  return <ModalContent key={componentKey} {...props} />;
}

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

  const formatSlug = (text: string) => {
    let slug = text.toLowerCase();
    slug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    slug = slug.replace(/[đĐ]/g, "d");
    slug = slug.replace(/[^a-z0-9\s-]/g, "");
    slug = slug.replace(/\s+/g, "-");
    slug = slug.replace(/-+/g, "-");
    if (!slug.startsWith("/") && slug.length > 0) {
      slug = "/" + slug;
    }
    if (slug === "/") slug = "";
    return slug;
  };

  const handleSlugBlur = () => {
    const newSlug = formatSlug(formData.slug);
    handleChange("slug", newSlug);
  };

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
                placeholder="e.g. /privacy-policy"
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
              <select
                className="sp-form-select"
                value={formData.type}
                onChange={(e) =>
                  handleChange("type", e.target.value as PageType)
                }
                disabled={isViewMode || initialData?.isSystem}
              >
                <option value="" disabled>
                  Choose category
                </option>
                <option value="About Us">About Us</option>
                <option value="Policy">Policy</option>
                <option value="FAQ">FAQ</option>
                <option value="Contact">Contact</option>
                <option value="Guide">Guide</option>
                <option value="Promotion">Promotion</option>
                <option value="Company News">Company News</option>
              </select>
            </div>

            <div
              className="sp-form-group"
              style={{ flex: 1, display: "flex", flexDirection: "column" }}
            >
              <label className="sp-form-label">
                Content <span className="sp-required">*</span>
              </label>

              {/* new: vùng chứa SunEditor */}
              <div
                className={`sp-suneditor-wrapper ${isViewMode ? "disabled" : ""}`}
              >
                <SunEditor
                  setContents={formData.content}
                  onChange={(content) => handleChange("content", content)}
                  disable={isViewMode}
                  setOptions={{
                    height: "350px",
                    resizingBar: false /* new: Tắt thanh kéo giãn ở dưới cùng */,
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
