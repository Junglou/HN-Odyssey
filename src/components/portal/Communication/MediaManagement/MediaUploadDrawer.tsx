import { useState, useEffect, useRef } from "react";
import "./MediaUploadDrawer.css";
import {
  ArrowLeftIcon,
  ChevronDownSmallIcon,
} from "../../../../assets/icons/MediaManagementIcons";
import type {
  MediaFormData,
  MediaType,
  MediaRecord,
  TargetOption,
} from "../../../../hooks/portal/Communication/MediaManagement/useMediaManagement";

export interface UploadDraft {
  id: string;
  file: File;
  previewUrl: string;
}

export interface MediaUploadDrawerProps {
  isOpen: boolean;
  mode: "upload" | "edit" | "view";
  previewUrl?: string;
  fileName?: string;
  initialData?: MediaRecord | null;
  uploadDrafts?: UploadDraft[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: MediaFormData | MediaFormData[]) => void;
  searchTargets: (type: MediaType, keyword: string) => Promise<TargetOption[]>;
  resolveTargetName: (type: MediaType, id: string) => Promise<string>;
}

export default function MediaUploadDrawer(props: MediaUploadDrawerProps) {
  if (!props.isOpen) return null;
  const modalKey =
    (props.mode === "edit" || props.mode === "view") && props.initialData
      ? props.initialData.id
      : props.uploadDrafts?.[0]?.id || props.fileName || "upload-drawer";

  return <DrawerContent key={modalKey} {...props} />;
}

function MediaFormSection({
  index,
  mode,
  previewUrl,
  fileName,
  initialTargetId,
  formData,
  isSubmitting,
  onChange,
  searchTargets,
  resolveTargetName, // Bóc tách resolveTargetName từ Props
}: {
  index: number;
  mode: "upload" | "edit" | "view";
  previewUrl: string;
  fileName: string;
  initialTargetId?: string;
  formData: MediaFormData;
  isSubmitting: boolean;
  onChange: (index: number, updatedData: MediaFormData) => void;
  searchTargets: (type: MediaType, keyword: string) => Promise<TargetOption[]>;
  resolveTargetName: (type: MediaType, id: string) => Promise<string>;
}) {
  const [searchTerm, setSearchTerm] = useState<string>(initialTargetId || "");
  const [filteredTargets, setFilteredTargets] = useState<TargetOption[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [hasAutocompleteOpened, setHasAutocompleteOpened] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [hasTypeDropdownOpened, setHasTypeDropdownOpened] = useState(false);

  const autocompleteRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const isReadOnly = mode === "view";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(target)
      ) {
        setIsAutocompleteOpen(false);
      }
      if (
        typeDropdownRef.current &&
        !typeDropdownRef.current.contains(target)
      ) {
        setIsTypeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!formData.type || !searchTerm.trim()) {
      setFilteredTargets([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchTargets(
          formData.type as MediaType,
          searchTerm,
        );
        setFilteredTargets(results);
      } catch (error) {
        console.error("Lỗi khi fetch targets", error);
        setFilteredTargets([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [formData.type, searchTerm, searchTargets]);

  useEffect(() => {
    let isMounted = true;

    if (
      (mode === "edit" || mode === "view") &&
      initialTargetId &&
      formData.targetId === initialTargetId
    ) {
      setIsSearching(true);
      resolveTargetName(formData.type as MediaType, initialTargetId)
        .then((name: string) => {
          if (isMounted) setSearchTerm(name);
        })
        .finally(() => {
          if (isMounted) setIsSearching(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [
    mode,
    initialTargetId,
    formData.targetId,
    formData.type,
    resolveTargetName, // Đã fix dependency array warning
  ]);

  const updateField = (field: keyof MediaFormData, value: string) => {
    onChange(index, { ...formData, [field]: value });
  };

  const handleTypeChange = (newType: MediaType) => {
    onChange(index, { ...formData, type: newType, targetId: "" });
    setSearchTerm("");
    setFilteredTargets([]);
  };

  const toggleStatus = () => {
    if (isSubmitting || isReadOnly) return;
    onChange(index, {
      ...formData,
      status: formData.status === "Published" ? "Draft" : "Published",
    });
  };

  return (
    <div className="mm-drawer-section">
      <div className="mm-section-header">
        <div className="mm-drawer-preview-box">
          {fileName.toLowerCase().endsWith(".mp4") ||
          previewUrl.toLowerCase().endsWith(".mp4") ? (
            <video
              src={previewUrl}
              controls
              preload="metadata"
              playsInline
              controlsList="nodownload"
              className="mm-drawer-video-render" // Thay thế cho toàn bộ cục style inline cũ
            />
          ) : (
            <img src={previewUrl} alt="Preview" />
          )}
        </div>
        <div className="mm-drawer-filename" title={fileName}>
          {fileName}
        </div>
      </div>

      <div className="mm-form-group" ref={typeDropdownRef}>
        <label>
          Type <span className="mm-required">*</span>
        </label>
        <div className="mm-autocomplete-wrapper">
          <div
            className={`mm-drawer-select-trigger ${
              isSubmitting || isReadOnly ? "disabled" : ""
            }`}
            onClick={() => {
              if (!isSubmitting && !isReadOnly) {
                setIsTypeDropdownOpen(!isTypeDropdownOpen);
                if (!hasTypeDropdownOpened) setHasTypeDropdownOpened(true);
              }
            }}
          >
            <span
              className={
                formData.type
                  ? "mm-trigger-text-selected"
                  : "mm-trigger-text-placeholder"
              }
            >
              {formData.type || "Choose Type"}
            </span>
            <ChevronDownSmallIcon
              className={isTypeDropdownOpen ? "open" : ""}
            />
          </div>
          <div
            className={`mm-autocomplete-dropdown ${
              isTypeDropdownOpen
                ? "open"
                : hasTypeDropdownOpened
                  ? "closed"
                  : ""
            }`}
          >
            {(["Product", "Variant", "Category"] as const).map((opt) => (
              <div
                key={opt}
                className={`mm-autocomplete-item ${
                  formData.type === opt ? "active" : ""
                }`}
                onClick={() => {
                  handleTypeChange(opt);
                  setIsTypeDropdownOpen(false);
                }}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      </div>

      {formData.type && (
        <div className="mm-form-group" ref={autocompleteRef}>
          <label>
            Assign to {formData.type} <span className="mm-required">*</span>
          </label>
          <div className="mm-autocomplete-wrapper">
            <input
              type="text"
              placeholder={`Search ${formData.type} by name or SKU...`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsAutocompleteOpen(true);
                if (!hasAutocompleteOpened) setHasAutocompleteOpened(true);
                updateField("targetId", "");
              }}
              onFocus={() => {
                setIsAutocompleteOpen(true);
                if (!hasAutocompleteOpened) setHasAutocompleteOpened(true);
              }}
              disabled={isSubmitting || isReadOnly}
            />
            <div
              className={`mm-autocomplete-dropdown ${
                isAutocompleteOpen
                  ? "open"
                  : hasAutocompleteOpened
                    ? "closed"
                    : ""
              }`}
            >
              {isSearching ? (
                <div className="mm-autocomplete-empty">Searching...</div>
              ) : filteredTargets.length > 0 ? (
                filteredTargets.map((opt, idx) => (
                  <div
                    key={`${opt.id}-${idx}`}
                    className="mm-autocomplete-item"
                    onClick={() => {
                      updateField("targetId", opt.id);
                      setSearchTerm(opt.label);
                      setIsAutocompleteOpen(false);
                    }}
                  >
                    {opt.label}
                  </div>
                ))
              ) : searchTerm.trim() !== "" ? (
                <div className="mm-autocomplete-empty">No results found</div>
              ) : (
                <div className="mm-autocomplete-empty">
                  Type to search {formData.type}...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mm-form-group">
        <label>Alt Text</label>
        <textarea
          rows={3}
          placeholder="Enter alt text for SEO"
          value={formData.altText}
          onChange={(e) => updateField("altText", e.target.value)}
          disabled={isSubmitting || isReadOnly}
        ></textarea>
      </div>

      <div className="mm-form-group">
        <label>Status</label>
        <div className="mm-status-toggle-wrapper">
          <button
            type="button"
            role="switch"
            aria-checked={formData.status === "Published"}
            className={`mm-toggle-switch ${
              formData.status === "Published" ? "on" : ""
            }`}
            onClick={toggleStatus}
            disabled={isSubmitting || isReadOnly}
          ></button>
          <span className="mm-status-label">
            {formData.status === "Published" ? "Publish" : "Draft"}
          </span>
        </div>
      </div>
    </div>
  );
}

function DrawerContent({
  mode,
  previewUrl,
  fileName,
  initialData,
  uploadDrafts,
  isSubmitting,
  onClose,
  onSubmit,
  searchTargets,
  resolveTargetName, // Bóc tách từ Props
}: Omit<MediaUploadDrawerProps, "isOpen">) {
  const [formsData, setFormsData] = useState<MediaFormData[]>(() => {
    if (mode === "upload" && uploadDrafts && uploadDrafts.length > 0) {
      return uploadDrafts.map(() => ({
        type: "",
        targetId: "",
        altText: "",
        status: "Draft",
      }));
    }
    if ((mode === "edit" || mode === "view") && initialData) {
      return [
        {
          type: initialData.type,
          targetId: initialData.targetId,
          altText: initialData.altText,
          status: initialData.status,
        },
      ];
    }
    return [];
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isSubmitting]);

  const handleSectionChange = (index: number, updatedData: MediaFormData) => {
    setFormsData((prev) => {
      const newData = [...prev];
      newData[index] = updatedData;
      return newData;
    });
  };

  const isFormValid =
    formsData.length > 0 &&
    formsData.every((f) => f.type !== "" && f.targetId !== "");
  const isReadOnly = mode === "view";

  const handleSave = () => {
    if (isSubmitting || !isFormValid || isReadOnly) return;
    if (mode === "upload") {
      onSubmit(formsData);
    } else {
      onSubmit(formsData[0]);
    }
  };

  return (
    <div
      className="mm-drawer-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="mm-drawer-container">
        <div className="mm-drawer-header">
          <button
            type="button"
            className="mm-drawer-back-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <ArrowLeftIcon />
          </button>
          <h2 className="mm-drawer-title">
            {mode === "view"
              ? "Media Details"
              : mode === "edit"
                ? "Edit Media Info"
                : `Upload Media`}
          </h2>
        </div>

        <div className="mm-drawer-body">
          {mode === "upload" && uploadDrafts ? (
            uploadDrafts.map((draft, i) => (
              <MediaFormSection
                key={draft.id}
                index={i}
                mode={mode}
                previewUrl={draft.previewUrl}
                fileName={draft.file.name}
                formData={formsData[i]}
                isSubmitting={isSubmitting}
                onChange={handleSectionChange}
                searchTargets={searchTargets}
                resolveTargetName={resolveTargetName} // Truyền xuống
              />
            ))
          ) : initialData ? (
            <MediaFormSection
              index={0}
              mode={mode}
              previewUrl={previewUrl || ""}
              fileName={initialData.fileName || fileName || ""}
              initialTargetId={initialData.targetId}
              formData={formsData[0]}
              isSubmitting={isSubmitting}
              onChange={handleSectionChange}
              searchTargets={searchTargets}
              resolveTargetName={resolveTargetName} // Truyền xuống
            />
          ) : null}
        </div>

        <div className="mm-drawer-footer">
          {!isReadOnly && (
            <button
              type="button"
              className={`mm-btn-submit ${
                isFormValid && !isSubmitting ? "active" : ""
              }`}
              onClick={handleSave}
              disabled={isSubmitting || !isFormValid}
            >
              {isSubmitting
                ? "Saving..."
                : mode === "edit"
                  ? "Save Changes"
                  : "Save & Upload"}
            </button>
          )}
          <button
            type="button"
            className="mm-btn-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {isReadOnly ? "Close" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
