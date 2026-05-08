import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import "./MediaManagement.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import {
  SearchIcon,
  ChevronDownSmallIcon,
  EyeIcon,
  StarIcon,
  CropIcon,
  ReplaceIcon,
  TrashIcon,
} from "../../../../assets/icons/MediaManagementIcons";
import type {
  MediaRecord,
  MediaStatus,
  MediaType,
} from "../../../../hooks/portal/Communication/MediaManagement/useMediaManagement";

interface MediaManagementProps {
  data: MediaRecord[];
  search: string;
  statusFilter: MediaStatus | "All";
  typeFilter: MediaType | "All";
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalFiltered: number;
    startIndex: number;
  };
  actions: {
    changeSearch: (val: string) => void;
    changeStatusFilter: (status: MediaStatus | "All") => void;
    changeTypeFilter: (type: MediaType | "All") => void;
    clearFilters: () => void;
    changePage: (page: number) => void;
    changeLimit: (limit: number) => void;
    openUploadDrawer: (files: File | FileList | File[]) => void;
    openEditDrawer: (record: MediaRecord) => void;
    openViewDrawer: (record: MediaRecord) => void;
    replaceMedia: (id: string, file: File) => void;
    setPrimaryMedia: (id: string) => void;
    deleteMedia: (id: string) => void;
    openCropModal: (record: MediaRecord) => void;
  };
}

export default function MediaManagement({
  data,
  search,
  statusFilter,
  typeFilter,
  pagination,
  actions,
}: MediaManagementProps) {
  // dropdown state
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [hasStatusOpened, setHasStatusOpened] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [hasTypeOpened, setHasTypeOpened] = useState(false);
  const [isLimitDropdownOpen, setIsLimitDropdownOpen] = useState(false);
  const [hasLimitOpened, setHasLimitOpened] = useState(false);

  const [isDragging, setIsDragging] = useState(false);

  const statusRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const limitRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const [replacingId, setReplacingId] = useState<string | null>(null);

  // click outside
  useClickOutside(statusRef, () => setIsStatusOpen(false));
  useClickOutside(typeRef, () => setIsTypeOpen(false));
  useClickOutside(limitRef, () => setIsLimitDropdownOpen(false));

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      actions.openUploadDrawer(files);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      actions.openUploadDrawer(files);
    }
    e.target.value = "";
  };

  const triggerReplaceInput = (id: string) => {
    setReplacingId(id);
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.click();
    }
  };

  const handleReplaceFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && replacingId) {
      actions.replaceMedia(replacingId, files[0]);
    }
    e.target.value = "";
    setReplacingId(null);
  };

  return (
    <div className="mm-container">
      <div className="mm-header">
        <div>
          <h1 className="mm-title">Media Management</h1>
          <p className="mm-breadcrumb">
            Communication Management / Media Management
          </p>
        </div>
        <button
          type="button"
          className="mm-btn-upload"
          onClick={triggerFileInput}
        >
          Upload Media
        </button>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg, image/png, image/webp, video/mp4"
          multiple
          onChange={handleFileInputChange}
          style={{ display: "none" }}
          id="upload-media-input"
        />
        <input
          type="file"
          ref={replaceFileInputRef}
          style={{ display: "none" }}
          accept="image/jpeg, image/png, image/webp, video/mp4"
          onChange={handleReplaceFileInputChange}
        />
      </div>

      <div className="mm-filters-card">
        <div className="mm-toolbar">
          <div className="mm-filters-row">
            <div className="mm-search-wrapper">
              <SearchIcon />
              <input
                type="text"
                className="mm-filter-input"
                placeholder="Search by file name or alt text"
                value={search}
                onChange={(e) => actions.changeSearch(e.target.value)}
              />
            </div>

            <div className="mm-custom-dropdown" ref={statusRef}>
              <div
                className="mm-dropdown-trigger"
                onClick={() => {
                  setIsStatusOpen(!isStatusOpen);
                  if (!hasStatusOpened) setHasStatusOpened(true);
                }}
              >
                <span>{statusFilter === "All" ? "Status" : statusFilter}</span>
                <ChevronDownSmallIcon
                  className={`mm-dropdown-arrow ${isStatusOpen ? "open" : ""}`}
                />
              </div>
              <div
                className={`mm-dropdown-options ${isStatusOpen ? "open" : hasStatusOpened ? "closed" : ""}`}
              >
                {(["All", "Published", "Draft", "Hidden"] as const).map(
                  (opt) => (
                    <div
                      key={opt}
                      className={`mm-dropdown-option ${statusFilter === opt ? "active" : ""}`}
                      onClick={() => {
                        actions.changeStatusFilter(opt);
                        setIsStatusOpen(false);
                      }}
                    >
                      {opt}
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="mm-custom-dropdown" ref={typeRef}>
              <div
                className="mm-dropdown-trigger"
                onClick={() => {
                  setIsTypeOpen(!isTypeOpen);
                  if (!hasTypeOpened) setHasTypeOpened(true);
                }}
              >
                <span>{typeFilter === "All" ? "Media Type" : typeFilter}</span>
                <ChevronDownSmallIcon
                  className={`mm-dropdown-arrow ${isTypeOpen ? "open" : ""}`}
                />
              </div>
              <div
                className={`mm-dropdown-options ${isTypeOpen ? "open" : hasTypeOpened ? "closed" : ""}`}
              >
                {(["All", "Category", "Product", "Variant"] as const).map(
                  (opt) => (
                    <div
                      key={opt}
                      className={`mm-dropdown-option ${typeFilter === opt ? "active" : ""}`}
                      onClick={() => {
                        actions.changeTypeFilter(opt);
                        setIsTypeOpen(false);
                      }}
                    >
                      {opt}
                    </div>
                  ),
                )}
              </div>
            </div>

            <button
              type="button"
              className="mm-btn-clear"
              onClick={actions.clearFilters}
            >
              Clear Filter
            </button>
          </div>
        </div>

        <div
          className={`mm-dropzone ${isDragging ? "dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <p>
            Drag & drop files here, or{" "}
            <span className="mm-browse-text" onClick={triggerFileInput}>
              click browse
            </span>
            .
          </p>
          <p className="mm-dropzone-sub">
            Images (JPG, PNG, WEBP - Max 20MB) | Videos (MP4 - Max 200MB)
          </p>
        </div>

        <div className="mm-grid">
          {data.length > 0 ? (
            data.map((record) => {
              const isVideo = record.fileName.toLowerCase().endsWith(".mp4");

              return (
                <div className="mm-card" key={record.id}>
                  <div className="mm-card-thumbnail">
                    {isVideo ? (
                      <video
                        src={record.url}
                        controls
                        preload="metadata"
                        playsInline
                        controlsList="nodownload"
                        className="mm-card-video"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <img
                        src={record.url}
                        alt={record.altText || record.fileName}
                        onClick={() => actions.openEditDrawer(record)}
                        style={{ cursor: "pointer" }}
                        title="Click to edit info"
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://placehold.co/400x300/f3f4f6/9ca3af?text=Image+Not+Found";
                        }}
                      />
                    )}
                    <button
                      type="button"
                      className="mm-card-view-btn"
                      title="View Details"
                      style={{ color: "#000000" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        actions.openViewDrawer(record);
                      }}
                    >
                      <EyeIcon />
                    </button>
                    {record.isPrimary && (
                      <span className="mm-card-primary-badge">
                        <StarIcon /> Primary
                      </span>
                    )}
                  </div>

                  <div
                    className="mm-card-info"
                    onClick={() => actions.openEditDrawer(record)}
                    style={{ cursor: "pointer" }}
                    title="Click to edit media info"
                  >
                    <div className="mm-card-filename" title={record.fileName}>
                      {record.fileName}
                    </div>
                    <div className="mm-card-badges">
                      <span className="mm-card-badge type-badge">
                        {record.type || "Uncategorized"}
                      </span>
                      <span
                        className={`mm-card-badge status-badge ${record.status.toLowerCase()}`}
                      >
                        {record.status || "Draft"}
                      </span>
                    </div>
                  </div>

                  <div className="mm-card-actions">
                    <button
                      type="button"
                      className={`mm-action-btn ${isVideo ? "disabled" : ""}`}
                      onClick={() => {
                        if (!isVideo) actions.setPrimaryMedia(record.id);
                      }}
                      disabled={record.isPrimary || isVideo}
                      title={
                        isVideo
                          ? "Video không thể làm ảnh đại diện"
                          : "Set Primary"
                      }
                    >
                      Set Primary
                    </button>
                    <button
                      type="button"
                      className={`mm-action-btn ${isVideo ? "disabled" : ""}`}
                      onClick={() => {
                        if (!isVideo) actions.openCropModal(record);
                      }}
                      disabled={isVideo}
                      title={isVideo ? "Không thể cắt video" : "Crop"}
                    >
                      <CropIcon /> Crop
                    </button>
                    <button
                      type="button"
                      className="mm-action-btn"
                      onClick={() => triggerReplaceInput(record.id)}
                    >
                      <ReplaceIcon /> Replace
                    </button>
                    <button
                      type="button"
                      className="mm-action-btn delete-btn"
                      onClick={() => actions.deleteMedia(record.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="mm-empty-state">
              No files found matching your criteria.
            </div>
          )}
        </div>

        <div className="mm-pagination">
          <span className="mm-pagination-info">
            Showing{" "}
            {pagination.totalFiltered === 0 ? 0 : pagination.startIndex + 1} to{" "}
            {Math.min(
              pagination.startIndex + pagination.limit,
              pagination.totalFiltered,
            )}{" "}
            of {pagination.totalFiltered} files
          </span>
          <div className="mm-page-numbers">
            <button
              className="mm-page-num"
              disabled={pagination.page === 1}
              onClick={() => actions.changePage(pagination.page - 1)}
            >
              &lt;
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (num) => (
                <button
                  key={num}
                  className={`mm-page-num ${pagination.page === num ? "active" : ""}`}
                  onClick={() => actions.changePage(num)}
                >
                  {num}
                </button>
              ),
            )}
            <button
              className="mm-page-num"
              disabled={
                pagination.page === pagination.totalPages ||
                pagination.totalPages === 0
              }
              onClick={() => actions.changePage(pagination.page + 1)}
            >
              &gt;
            </button>

            <div className="mm-limit-dropdown" ref={limitRef}>
              <div
                className={`mm-limit-trigger ${isLimitDropdownOpen ? "active" : ""}`}
                onClick={() => {
                  setIsLimitDropdownOpen(!isLimitDropdownOpen);
                  if (!hasLimitOpened) setHasLimitOpened(true);
                }}
              >
                <span>{pagination.limit} / page</span>
                <div
                  className={`mm-limit-icon ${isLimitDropdownOpen ? "open" : ""}`}
                >
                  <ChevronDownSmallIcon />
                </div>
              </div>
              <div
                className={`mm-limit-options ${isLimitDropdownOpen ? "open" : hasLimitOpened ? "closed" : ""}`}
              >
                {[10, 20, 50].map((val) => (
                  <div
                    key={val}
                    className={`mm-limit-option ${pagination.limit === val ? "active" : ""}`}
                    onClick={() => {
                      actions.changeLimit(val);
                      setIsLimitDropdownOpen(false);
                    }}
                  >
                    {val} / page
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
