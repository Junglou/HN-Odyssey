import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import "./ReviewAndRatingDrawer.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import {
  StarIcon,
  HeartIcon,
  ArrowLeftIcon,
  ChevronDownSmallIcon,
} from "../../../../assets/icons/ReviewAndRatingManagementIcons";
import type {
  ReviewRecord,
  DrawerMode,
} from "../../../../hooks/portal/MarketingSuite/ReviewAndRatingManagement/useReviewAndRatingManagement";
import { toast } from "react-toastify";

interface ReviewAndRatingDrawerProps {
  isOpen: boolean;
  review: ReviewRecord | null;
  mode: DrawerMode;
  onClose: () => void;
  onSave: (
    id: string,
    updates: {
      officialResponse: string;
      isUserBanned: boolean;
      blockReason: string;
      blockNote: string;
      isPinned: boolean;
    },
  ) => void;
}

export default function ReviewAndRatingDrawer(
  props: ReviewAndRatingDrawerProps,
) {
  const [shouldRender, setShouldRender] = useState(props.isOpen);
  const [isClosing, setIsClosing] = useState(false);

  if (props.isOpen && !shouldRender) {
    setShouldRender(true);
    setIsClosing(false);
  }

  useEffect(() => {
    if (!props.isOpen && shouldRender) {
      const startClosingTimer = setTimeout(() => {
        setIsClosing(true);
      }, 0);

      const unmountTimer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 300);

      return () => {
        clearTimeout(startClosingTimer);
        clearTimeout(unmountTimer);
      };
    }
  }, [props.isOpen, shouldRender]);

  if (!shouldRender || (!props.review && !isClosing)) return null;

  return (
    <DrawerContent
      key={props.review?.id || "empty-review-key"}
      {...props}
      review={props.review as ReviewRecord}
      isClosing={isClosing}
    />
  );
}

function DrawerContent({
  review,
  mode,
  onClose,
  onSave,
  isClosing,
}: Omit<ReviewAndRatingDrawerProps, "isOpen" | "review"> & {
  review: ReviewRecord;
  isClosing?: boolean;
}) {
  const [tempResponse, setTempResponse] = useState(
    review.officialResponse || "",
  );
  const [tempBlockReason, setTempBlockReason] = useState(
    review.blockReason || "",
  );
  const [tempBlockNote, setTempBlockNote] = useState(review.blockNote || "");
  const [tempIsPinned, setTempIsPinned] = useState(!!review.isPinned);
  const [isResponsePublished, setIsResponsePublished] = useState(
    !!review.officialResponse,
  );
  const [isBlockSubmitted, setIsBlockSubmitted] = useState(review.isUserBanned);

  const [isReasonOpen, setIsReasonOpen] = useState(false);
  const [hasReasonOpened, setHasReasonOpened] = useState(false);
  const reasonRef = useRef<HTMLDivElement>(null);

  // STATE MODAL ZOOM ẢNH DÀNH CHO ADMIN
  const [expandedMedia, setExpandedMedia] = useState<{
    url: string;
    type: "IMAGE" | "VIDEO";
  } | null>(null);

  useClickOutside(reasonRef, () => setIsReasonOpen(false));

  const isPublishValid = tempResponse.trim() !== "";
  const isSubmitValid =
    tempBlockReason !== "" &&
    (tempBlockReason !== "Other" || tempBlockNote.trim() !== "");

  const renderStars = (rating: number) => (
    <div className="rarm-drawer-stars">
      {Array.from({ length: 5 }).map((_, idx) => (
        <StarIcon
          key={idx}
          className={idx < rating ? "rarm-star-active" : "rarm-star-inactive"}
        />
      ))}
    </div>
  );

  const handlePublish = () => {
    if (tempResponse.trim() === "") {
      toast.error("Vui lòng nhập nội dung phản hồi.");
      return;
    }
    setIsResponsePublished(true);
    toast.success("Đã ghi nhận phản hồi (Chờ Confirm).");
  };

  const handleSubmitBlock = () => {
    if (tempBlockReason === "") {
      toast.error("Vui lòng chọn lý do khóa.");
      return;
    }
    if (tempBlockReason === "Other" && tempBlockNote.trim() === "") {
      toast.error("Vui lòng nhập lý do chi tiết.");
      return;
    }
    setIsBlockSubmitted(true);
    toast.warning("Đã ghi nhận lệnh khóa (Chờ Confirm).");
  };

  const handleConfirm = () => {
    onSave(review.id, {
      officialResponse: isResponsePublished
        ? tempResponse
        : review.officialResponse || "",
      isUserBanned: isBlockSubmitted,
      blockReason: isBlockSubmitted ? tempBlockReason : "",
      blockNote:
        isBlockSubmitted && tempBlockReason === "Other" ? tempBlockNote : "",
      isPinned: tempIsPinned,
    });
  };

  return (
    <>
      <div
        className={`rarm-drawer-overlay ${isClosing ? "closing" : ""}`}
        onClick={onClose}
      />
      <div className={`rarm-drawer-container ${isClosing ? "closing" : ""}`}>
        <div className="rarm-drawer-header">
          <button type="button" className="rarm-btn-back" onClick={onClose}>
            <ArrowLeftIcon />
          </button>
          <h2 className="rarm-drawer-title">Review Details</h2>

          <button
            type="button"
            className={`rarm-drawer-heart-btn ${tempIsPinned ? "pinned" : ""} ${
              mode === "view" ? "readonly" : ""
            }`}
            onClick={() => {
              if (mode === "edit") {
                setTempIsPinned(!tempIsPinned);
                toast.info(
                  !tempIsPinned
                    ? "Đã đánh dấu ghim (Chờ Confirm)."
                    : "Đã hủy ghim (Chờ Confirm).",
                );
              }
            }}
            disabled={mode === "view"}
            title={
              mode === "view"
                ? "Read-only mode"
                : tempIsPinned
                  ? "Unpin Review"
                  : "Pin Review"
            }
          >
            <HeartIcon />
          </button>
        </div>

        <div className="rarm-drawer-body">
          <div className="rarm-review-info-section">
            <h3 className="rarm-product-name">{review.productName}</h3>
            <span className="rarm-customer-name">{review.customerName}</span>
            {renderStars(review.rating)}
            <p className="rarm-review-content">{review.reviewContent}</p>

            {/* HIỂN THỊ ẢNH CỦA ĐÁNH GIÁ GỐC */}
            {review.media && review.media.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginTop: "12px",
                  marginBottom: "12px",
                }}
              >
                {review.media.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "6px",
                      overflow: "hidden",
                      border: "1px solid #d1d5db",
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      setExpandedMedia({ url: m.url, type: m.type })
                    }
                  >
                    {m.type === "VIDEO" ? (
                      <video
                        src={m.url}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        muted
                      />
                    ) : (
                      <img
                        src={m.url}
                        alt="review-media"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="rarm-submitted-date">
              Submitted: {review.submittedDate}
            </p>

            {/* HIỂN THỊ BÌNH LUẬN TRẢ LỜI */}
            {review.customerReplies && review.customerReplies.length > 0 && (
              <div
                style={{
                  marginTop: "16px",
                  borderTop: "1px solid #e5e7eb",
                  paddingTop: "12px",
                }}
              >
                <h4
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#111827",
                    margin: "0 0 12px 0",
                  }}
                >
                  Customer Replies ({review.customerReplies.length})
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    maxHeight: "250px",
                    overflowY: "auto",
                  }}
                >
                  {review.customerReplies.map((reply, index) => (
                    <div
                      key={index}
                      style={{
                        background: "#f9fafb",
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid #f3f4f6",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#6b7280",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        {reply.date}
                      </span>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          color: "#374151",
                          lineHeight: "1.4",
                        }}
                      >
                        {reply.content}
                      </p>

                      {/* HIỂN THỊ ẢNH CỦA REPLY NẾU CÓ */}
                      {reply.media && reply.media.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            flexWrap: "wrap",
                            marginTop: "8px",
                          }}
                        >
                          {reply.media.map((m, idx) => (
                            <div
                              key={idx}
                              style={{
                                width: "45px",
                                height: "45px",
                                borderRadius: "4px",
                                overflow: "hidden",
                                border: "1px solid #d1d5db",
                                cursor: "pointer",
                              }}
                              onClick={() =>
                                setExpandedMedia({ url: m.url, type: m.type })
                              }
                            >
                              {m.type === "VIDEO" ? (
                                <video
                                  src={m.url}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                  muted
                                />
                              ) : (
                                <img
                                  src={m.url}
                                  alt="reply-media"
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {mode === "edit" && (
            <div className="rarm-edit-forms">
              {/* Form Response */}
              <div className="rarm-form-block">
                <label className="rarm-form-label">Response</label>
                <textarea
                  className={`rarm-textarea ${review.officialResponse ? "disabled" : ""}`}
                  placeholder="Response customer here... (Max 500 characters)"
                  value={tempResponse}
                  maxLength={500}
                  onChange={(e) => {
                    setTempResponse(e.target.value);
                    setIsResponsePublished(false);
                  }}
                  rows={4}
                  disabled={Boolean(review.officialResponse)}
                />
                <div className="rarm-btn-row-space">
                  <span
                    className={`rarm-char-count ${tempResponse.length >= 500 ? "limit" : ""}`}
                  >
                    {tempResponse.length}/500
                  </span>
                  <button
                    type="button"
                    className={`rarm-btn-publish ${isPublishValid ? "active" : ""} ${
                      review.officialResponse ? "readonly" : ""
                    }`}
                    onClick={handlePublish}
                    disabled={Boolean(review.officialResponse)}
                  >
                    {isResponsePublished ? "Published" : "Publish"}
                  </button>
                </div>
              </div>

              {/* Form Block */}
              <div className="rarm-form-block">
                <div className="rarm-drawer-dropdown" ref={reasonRef}>
                  <div
                    className={`rarm-drawer-dropdown-trigger ${isReasonOpen ? "active" : ""}`}
                    onClick={() => {
                      setIsReasonOpen(!isReasonOpen);
                      if (!hasReasonOpened) setHasReasonOpened(true);
                    }}
                  >
                    <span
                      className={
                        tempBlockReason === "" ? "rarm-placeholder" : ""
                      }
                    >
                      {tempBlockReason === ""
                        ? "Choose reason"
                        : tempBlockReason === "Spam"
                          ? "Spam or fake review"
                          : tempBlockReason === "Offensive"
                            ? "Offensive language"
                            : "Other"}
                    </span>
                    <ChevronDownSmallIcon
                      className={`rarm-drawer-dropdown-arrow ${isReasonOpen ? "open" : ""}`}
                    />
                  </div>

                  <div
                    className={`rarm-drawer-dropdown-options ${
                      isReasonOpen ? "open" : hasReasonOpened ? "closed" : ""
                    }`}
                  >
                    {[
                      { value: "Spam", label: "Spam or fake review" },
                      { value: "Offensive", label: "Offensive language" },
                      { value: "Other", label: "Other" },
                    ].map((opt) => (
                      <div
                        key={opt.value}
                        className={`rarm-drawer-dropdown-option ${
                          tempBlockReason === opt.value ? "active" : ""
                        }`}
                        onClick={() => {
                          setTempBlockReason(opt.value);
                          setIsBlockSubmitted(false);
                          setIsReasonOpen(false);
                        }}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                </div>

                {tempBlockReason === "Other" && (
                  <textarea
                    className="rarm-textarea rarm-reason-input"
                    placeholder="Input reason..."
                    value={tempBlockNote}
                    onChange={(e) => {
                      setTempBlockNote(e.target.value);
                      setIsBlockSubmitted(false);
                    }}
                    rows={3}
                  />
                )}

                <div
                  className={`rarm-btn-right-wrapper ${
                    tempBlockReason === "Other" ? "no-mt" : ""
                  }`}
                >
                  <button
                    type="button"
                    className={`rarm-btn-submit ${isSubmitValid ? "danger" : ""}`}
                    onClick={handleSubmitBlock}
                  >
                    {isBlockSubmitted ? "Submitted" : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rarm-drawer-footer">
          <div className="rarm-footer-actions">
            <button
              type="button"
              className="rarm-btn-bottom rarm-btn-confirm"
              onClick={handleConfirm}
              disabled={mode === "view"}
            >
              Confirm
            </button>
            <button
              type="button"
              className="rarm-btn-bottom rarm-btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* PORTAL MODAL ZOOM CHO ADMIN */}
      {expandedMedia &&
        createPortal(
          <div
            className="rarm-media-modal-overlay"
            onClick={() => setExpandedMedia(null)}
          >
            <div
              className="rarm-media-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="rarm-media-modal-close"
                onClick={() => setExpandedMedia(null)}
              >
                &times;
              </button>
              {expandedMedia.type === "VIDEO" ? (
                <video src={expandedMedia.url} controls autoPlay />
              ) : (
                <img src={expandedMedia.url} alt="Zoomed view" />
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
