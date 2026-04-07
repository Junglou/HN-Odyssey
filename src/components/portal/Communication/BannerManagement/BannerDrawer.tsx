import { useState, useEffect, useRef, type ChangeEvent } from "react";
import "./BannerDrawer.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import {
  ArrowLeftIcon,
  ImageIcon,
  ChevronDownSmallIcon,
} from "../../../../assets/icons/BannerManagementIcons";
import type {
  BannerRecord,
  BannerFormData,
  BannerPosition,
} from "../../../../hooks/portal/Communication/BannerManagement/useBannerManagement";

export interface BannerDrawerProps {
  isOpen: boolean;
  mode: "create" | "edit" | "view";
  initialData: BannerRecord | null;
  onClose: () => void;
  onSubmit: (data: BannerFormData) => void;
}

export default function BannerDrawer(props: BannerDrawerProps) {
  if (!props.isOpen) return null;
  const drawerKey = props.initialData?.id || "new-banner";
  return <BannerDrawerContent key={drawerKey} {...props} />;
}

function BannerDrawerContent({
  mode,
  initialData,
  onClose,
  onSubmit,
}: Omit<BannerDrawerProps, "isOpen">) {
  const [formData, setFormData] = useState<BannerFormData>({
    title: initialData?.name || "",
    position: initialData?.position || "Homepage Slider",
    categoryId: initialData?.categoryId || "",
    targetUrl: initialData?.targetUrl || "",
    startDate: initialData?.startDate || "",
    endDate: initialData?.endDate || "",
    status: initialData?.status || "Inactive",
    imageDesktopUrl: initialData?.imageDesktopUrl || "",
    imageMobileUrl: initialData?.imageMobileUrl || "",
  });

  const [isPosOpen, setIsPosOpen] = useState(false);
  const [isCatOpen, setIsCatOpen] = useState(false);

  const posRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  useClickOutside(posRef, () => setIsPosOpen(false));
  useClickOutside(catRef, () => setIsCatOpen(false));

  const isViewMode = mode === "view";
  const todayDate = new Date().toISOString().split("T")[0];

  const isPending = !!(formData.startDate && formData.startDate > todayDate);
  const isExpired = !!(formData.endDate && formData.endDate < todayDate);
  const isToggleDisabled = !!(isViewMode || isPending || isExpired);

  const isFormValid = !!(
    formData.title.trim() &&
    formData.targetUrl.trim() &&
    formData.imageDesktopUrl
  );

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const updateField = (field: keyof BannerFormData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "startDate" || field === "endDate") {
        const start = field === "startDate" ? value : prev.startDate;
        const end = field === "endDate" ? value : prev.endDate;

        if (start && start > todayDate) {
          updated.status = "Pending";
        } else if (end && end < todayDate) {
          if (updated.status === "Pending" || updated.status === "Active") {
            updated.status = "Inactive";
          }
        } else if (updated.status === "Pending") {
          updated.status = "Inactive";
        }
      }
      return updated;
    });
  };

  const handleToggle = () => {
    if (isToggleDisabled) return;
    updateField("status", formData.status === "Active" ? "Inactive" : "Active");
  };

  const handleFile = (
    e: ChangeEvent<HTMLInputElement>,
    type: "desktop" | "mobile",
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateField(
        type === "desktop" ? "imageDesktopUrl" : "imageMobileUrl",
        url,
      );
    }
  };

  const CATEGORY_OPTIONS = [
    { id: "cat-fashion", name: "Fashion & Clothing" },
    { id: "cat-electronics", name: "Electronics" },
    { id: "cat-home", name: "Home & Living" },
  ];
  const selectedCat = CATEGORY_OPTIONS.find(
    (c) => c.id === formData.categoryId,
  );

  return (
    <div
      className="bm-drawer-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bm-drawer-container">
        <div className="bm-drawer-header">
          <button
            type="button"
            className="bm-drawer-back-btn"
            onClick={onClose}
          >
            <ArrowLeftIcon />
          </button>
          <h2 className="bm-drawer-title">
            {mode === "create"
              ? "Create Banner"
              : mode === "edit"
                ? "Edit Banner"
                : "Banner Details"}
          </h2>
        </div>

        <div className="bm-drawer-body">
          <div className="bm-form-group">
            <label>Banner Title</label>
            <input
              type="text"
              placeholder="e.g., Summer Sale 2024"
              value={formData.title}
              onChange={(e) => updateField("title", e.target.value)}
              disabled={isViewMode}
            />
          </div>

          <div className="bm-form-group">
            <label>Desktop Image</label>
            <div
              className={`bm-upload-box ${isViewMode ? "disabled" : ""}`}
              onClick={() => !isViewMode && desktopInputRef.current?.click()}
            >
              {formData.imageDesktopUrl ? (
                <img src={formData.imageDesktopUrl} alt="Preview" />
              ) : (
                <>
                  <ImageIcon />
                  <span>Upload (16:9, 21:9)</span>
                </>
              )}
            </div>
            <input
              type="file"
              ref={desktopInputRef}
              hidden
              accept="image/*"
              onChange={(e) => handleFile(e, "desktop")}
              disabled={isViewMode}
            />
          </div>

          <div className="bm-form-group">
            <label>Mobile Image (Optional)</label>
            <div
              className={`bm-upload-box ${isViewMode ? "disabled" : ""}`}
              onClick={() => !isViewMode && mobileInputRef.current?.click()}
            >
              {formData.imageMobileUrl ? (
                <img src={formData.imageMobileUrl} alt="Preview" />
              ) : (
                <>
                  <ImageIcon />
                  <span>Upload (4:5, 9:16)</span>
                </>
              )}
            </div>
            <input
              type="file"
              ref={mobileInputRef}
              hidden
              accept="image/*"
              onChange={(e) => handleFile(e, "mobile")}
              disabled={isViewMode}
            />
          </div>

          <div className="bm-form-group" ref={posRef}>
            <label>Display Position</label>
            <div className="bm-custom-select">
              <div
                className={`bm-select-trigger ${isViewMode ? "disabled" : ""} ${isPosOpen ? "active" : ""}`}
                onClick={() => !isViewMode && setIsPosOpen(!isPosOpen)}
              >
                <span>{formData.position}</span>
                <ChevronDownSmallIcon className={isPosOpen ? "open" : ""} />
              </div>
              {isPosOpen && (
                <div className="bm-select-options">
                  {(
                    [
                      "Homepage Slider",
                      "Category",
                      "Promotion",
                    ] as BannerPosition[]
                  ).map((opt) => (
                    <div
                      key={opt}
                      className={`bm-option ${formData.position === opt ? "active" : ""}`}
                      onClick={() => {
                        updateField("position", opt);
                        setIsPosOpen(false);
                      }}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {formData.position === "Category" && (
            <div className="bm-form-group" ref={catRef}>
              <label>Apply to Category</label>
              <div className="bm-custom-select">
                <div
                  className={`bm-select-trigger ${isViewMode ? "disabled" : ""} ${isCatOpen ? "active" : ""}`}
                  onClick={() => !isViewMode && setIsCatOpen(!isCatOpen)}
                >
                  <span>
                    {selectedCat ? selectedCat.name : "-- Select Category --"}
                  </span>
                  <ChevronDownSmallIcon className={isCatOpen ? "open" : ""} />
                </div>
                {isCatOpen && (
                  <div className="bm-select-options">
                    {CATEGORY_OPTIONS.map((cat) => (
                      <div
                        key={cat.id}
                        className={`bm-option ${formData.categoryId === cat.id ? "active" : ""}`}
                        onClick={() => {
                          updateField("categoryId", cat.id);
                          setIsCatOpen(false);
                        }}
                      >
                        {cat.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bm-form-group">
            <label>Target URL</label>
            <input
              type="text"
              placeholder="/collections/summer-sale"
              value={formData.targetUrl}
              onChange={(e) => updateField("targetUrl", e.target.value)}
              disabled={isViewMode}
            />
          </div>

          <div className="bm-date-row">
            <div className="bm-form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => updateField("startDate", e.target.value)}
                disabled={isViewMode}
              />
            </div>
            <div className="bm-form-group">
              <label>End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => updateField("endDate", e.target.value)}
                disabled={isViewMode}
              />
            </div>
          </div>

          <div className="bm-form-group">
            <label>Status</label>
            <div className="bm-toggle-wrapper">
              <button
                type="button"
                className={`bm-switch ${formData.status === "Active" ? "on" : ""}`}
                onClick={handleToggle}
                disabled={isToggleDisabled}
              ></button>
              <span className="bm-toggle-label">
                {isPending
                  ? "Pending (Wait)"
                  : isExpired
                    ? "Expired"
                    : formData.status}
              </span>
            </div>
          </div>
        </div>

        <div className="bm-drawer-footer">
          {!isViewMode && (
            <button
              type="button"
              className={`bm-btn-submit ${isFormValid ? "active" : ""}`}
              onClick={() => {
                onSubmit(formData);
                onClose();
              }}
              disabled={!isFormValid}
            >
              {mode === "create" ? "Create Banner" : "Save Changes"}
            </button>
          )}
          <button type="button" className="bm-btn-cancel" onClick={onClose}>
            {isViewMode ? "Close" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
