import { useState } from "react";
import "./ReviewAndRatingDrawer.css";
import {
  StarIcon,
  HeartIcon,
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
  if (!props.isOpen || !props.review) return null;
  return (
    <DrawerContent key={props.review.id} {...props} review={props.review} />
  );
}

function DrawerContent({
  review,
  mode,
  onClose,
  onSave,
}: Omit<ReviewAndRatingDrawerProps, "isOpen" | "review"> & {
  review: ReviewRecord;
}) {
  // State lưu trữ dữ liệu form tạm thời
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

  // Validation form
  const isPublishValid = tempResponse.trim() !== "";
  const isSubmitValid =
    tempBlockReason !== "" &&
    (tempBlockReason !== "Other" || tempBlockNote.trim() !== "");

  // Render sao đánh giá
  const renderStars = (rating: number) => {
    return (
      <div className="rarm-drawer-stars">
        {Array.from({ length: 5 }).map((_, idx) => (
          <StarIcon
            key={idx}
            className={idx < rating ? "rarm-star-active" : "rarm-star-inactive"}
          />
        ))}
      </div>
    );
  };

  // Xử lý phản hồi
  const handlePublish = () => {
    if (tempResponse.trim() === "") {
      toast.error("Vui lòng nhập nội dung phản hồi.");
      return;
    }
    setIsResponsePublished(true);
    toast.success("Đã ghi nhận phản hồi (Chờ Confirm để lưu).");
  };

  // Xử lý khóa tài khoản
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
    toast.warning("Đã ghi nhận lệnh khóa tài khoản (Chờ Confirm để lưu).");
  };

  // Xác nhận lưu thay đổi
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
      <div className="rarm-drawer-overlay" onClick={onClose}></div>

      <div className="rarm-drawer-container">
        <div className="rarm-drawer-header">
          <button type="button" className="rarm-btn-back" onClick={onClose}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <h2 className="rarm-drawer-title">Review Details</h2>

          <button
            type="button"
            className={`rarm-drawer-heart-btn ${tempIsPinned ? "pinned" : ""}`}
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
            style={{ cursor: mode === "view" ? "not-allowed" : "pointer" }}
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
          {/* Thông tin đánh giá */}
          <div className="rarm-review-info-section">
            <h3 className="rarm-product-name">{review.productName}</h3>
            <span className="rarm-customer-name">{review.customerName}</span>
            {renderStars(review.rating)}
            <p className="rarm-review-content">{review.reviewContent}</p>
            <p className="rarm-submitted-date">
              Submitted: {review.submittedDate}
            </p>
          </div>

          {/* Form nhập liệu */}
          {mode === "edit" && (
            <div className="rarm-edit-forms">
              <div className="rarm-form-block">
                <label className="rarm-form-label">Response</label>
                <textarea
                  className="rarm-textarea"
                  placeholder="Response customer here... (Max 500 characters)"
                  value={tempResponse}
                  maxLength={500}
                  onChange={(e) => {
                    setTempResponse(e.target.value);
                    setIsResponsePublished(false);
                  }}
                  rows={4}
                  disabled={Boolean(review.officialResponse)}
                  style={{
                    backgroundColor: review.officialResponse
                      ? "#f9fafb"
                      : "#ffffff",
                  }}
                />
                <div
                  className="rarm-btn-right-wrapper"
                  style={{
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: tempResponse.length >= 500 ? "#ef4444" : "#9ca3af",
                    }}
                  >
                    {tempResponse.length}/500
                  </span>
                  <button
                    type="button"
                    className={`rarm-btn-publish ${isPublishValid ? "active" : ""}`}
                    onClick={handlePublish}
                    disabled={Boolean(review.officialResponse)}
                    style={{
                      opacity: review.officialResponse ? 0.5 : 1,
                      cursor: review.officialResponse
                        ? "not-allowed"
                        : "pointer",
                    }}
                  >
                    {isResponsePublished ? "Published" : "Publish"}
                  </button>
                </div>
              </div>

              <div className="rarm-form-block">
                <select
                  className="rarm-select rarm-reason-select"
                  value={tempBlockReason}
                  onChange={(e) => {
                    setTempBlockReason(e.target.value);
                    setIsBlockSubmitted(false);
                  }}
                >
                  <option value="">Choose reason</option>
                  <option value="Spam">Spam or fake review</option>
                  <option value="Offensive">Offensive language</option>
                  <option value="Other">Other</option>
                </select>

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
                  className="rarm-btn-right-wrapper"
                  style={{
                    marginTop: tempBlockReason === "Other" ? "0" : "8px",
                  }}
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
    </>
  );
}
