import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom"; // <-- ĐÃ THÊM IMPORT NÀY
import { useProductReviews } from "../../hooks/productDetail/useProductReviews";
import {
  StarFilledIcon,
  StarEmptyIcon,
  CheckCircleIcon,
  LikeIcon,
  DislikeIcon,
  DropdownArrowIcon,
} from "../../assets/icons/ProductDetailIcons";
import ProductPagination from "../products/ProductPagination";
import EmojiPicker, {
  type EmojiClickData,
  EmojiStyle,
} from "emoji-picker-react";
import "./ProductReviews.css";

// --- INLINE ICONS ---
const InlineAttachmentIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
  </svg>
);

const InlineEmojiIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
    <line x1="9" y1="9" x2="9.01" y2="9"></line>
    <line x1="15" y1="9" x2="15.01" y2="9"></line>
  </svg>
);

function CustomDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || options[0]?.label;

  return (
    <div
      className={`pdp-custom-dropdown ${isOpen ? "is-open" : ""}`}
      ref={dropdownRef}
    >
      <div
        className={`pdp-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        <span>{selectedLabel}</span>
        <DropdownArrowIcon
          className={`pdp-dropdown-arrow ${isOpen ? "open" : ""}`}
        />
      </div>

      <div
        className={`pdp-dropdown-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`pdp-dropdown-option ${value === opt.value ? "selected" : ""}`}
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

export default function ProductReviews() {
  const {
    reviewStats,
    filters,
    sortOptions,
    reviews,
    activeFilter,
    sortBy,
    currentPage,
    totalPages,
    isWritingReview,
    userFeedback,
    newRating,
    reviewText,
    reviewMedia,
    isUploadingMedia,
    replyingTo,
    replyText,
    replyMedia,
    isUploadingReplyMedia,
    setReplyText,
    handleOpenReply,
    handleCloseReply,
    handleUploadMedia,
    handleUploadReplyMedia,
    handleSubmitCustomerReply,
    handleFilterChange,
    handleSortChange,
    handlePageChange,
    setIsWritingReview,
    handleFeedback,
    setNewRating,
    setReviewText,
    handleCancelReview,
    handleSubmitReview,
  } = useProductReviews();

  const [showReviewEmoji, setShowReviewEmoji] = useState(false);
  const [showReplyEmoji, setShowReplyEmoji] = useState(false);

  // STATE MỚI: Quản lý ảnh/video đang được phóng to
  const [expandedMedia, setExpandedMedia] = useState<{
    url: string;
    type: "IMAGE" | "VIDEO";
  } | null>(null);

  const onReviewEmojiClick = (emojiData: EmojiClickData) => {
    setReviewText((prev) => prev + emojiData.emoji);
  };

  const onReplyEmojiClick = (emojiData: EmojiClickData) => {
    setReplyText((prev) => prev + emojiData.emoji);
  };

  return (
    <div className="pdp-reviews-section">
      <h2 className="pdp-reviews-heading">Reviews & Ratings</h2>

      <div className="pdp-reviews-overview">
        <div className="pdp-rating-score-box">
          <span className="pdp-rating-big">
            {reviewStats.average.toFixed(1)}/5
          </span>
          <div className="pdp-stars-row">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star}>
                {star <= Math.round(reviewStats.average) ? (
                  <StarFilledIcon />
                ) : (
                  <StarEmptyIcon />
                )}
              </span>
            ))}
          </div>
          <span className="pdp-review-count">
            Based on {reviewStats.total} reviews
          </span>
        </div>

        <div className="pdp-write-review-box">
          {!isWritingReview && (
            <button
              className="pdp-write-btn"
              onClick={() => setIsWritingReview(true)}
            >
              Write a review
            </button>
          )}
        </div>
      </div>

      {isWritingReview && (
        <div className="pdp-review-form">
          <h3 className="pdp-form-title">Your Rating</h3>
          <div className="pdp-form-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                onClick={() => setNewRating(star)}
                style={{ cursor: "pointer" }}
              >
                {star <= newRating ? <StarFilledIcon /> : <StarEmptyIcon />}
              </span>
            ))}
          </div>

          <div style={{ position: "relative" }}>
            <textarea
              className="pdp-review-textarea"
              placeholder="What did you like or dislike? How did it fit?"
              rows={4}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            ></textarea>

            {showReviewEmoji && (
              <div className="pdp-emoji-picker-wrapper">
                <EmojiPicker
                  onEmojiClick={onReviewEmojiClick}
                  width={320}
                  height={400}
                  searchDisabled={false}
                  emojiStyle={EmojiStyle.NATIVE}
                />
              </div>
            )}
          </div>

          <div className="pdp-form-media-section">
            <div className="pdp-action-buttons-row">
              <input
                type="file"
                id="pdp-media-upload"
                multiple
                accept="image/*,video/*"
                style={{ display: "none" }}
                onChange={handleUploadMedia}
                disabled={isUploadingMedia || reviewMedia.length >= 5}
              />
              <label
                htmlFor="pdp-media-upload"
                className={`pdp-icon-action-btn ${isUploadingMedia || reviewMedia.length >= 5 ? "disabled" : ""}`}
              >
                <InlineAttachmentIcon />
                {isUploadingMedia ? "Uploading..." : "Photos/Videos"}
              </label>
              <button
                type="button"
                className="pdp-icon-action-btn"
                onClick={() => setShowReviewEmoji(!showReviewEmoji)}
              >
                <InlineEmojiIcon /> Emoji
              </button>
            </div>

            {reviewMedia.length > 0 && (
              <div className="pdp-media-preview-list">
                {reviewMedia.map((media, index) => (
                  <div key={index} className="pdp-media-preview-item">
                    {media.type === "VIDEO" ? (
                      <video
                        src={media.url}
                        className="pdp-preview-img"
                        muted
                      />
                    ) : (
                      <img
                        src={media.url}
                        alt={`upload-${index}`}
                        className="pdp-preview-img"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pdp-form-actions">
            <button
              className="pdp-form-cancel"
              onClick={() => {
                handleCancelReview();
                setShowReviewEmoji(false);
              }}
            >
              Cancel
            </button>
            <button
              className="pdp-form-submit"
              onClick={() => {
                handleSubmitReview();
                setShowReviewEmoji(false);
              }}
            >
              Submit Review
            </button>
          </div>
        </div>
      )}

      <div className="pdp-reviews-toolbar">
        <div className="pdp-sort-box">
          <span className="pdp-toolbar-label">Sort by:</span>
          <CustomDropdown
            value={sortBy}
            options={sortOptions}
            onChange={handleSortChange}
          />
        </div>

        <div className="pdp-filter-box">
          <span className="pdp-toolbar-label">Filter:</span>
          <div className="pdp-filter-chips">
            {filters.map((filter) => (
              <button
                key={filter}
                className={`pdp-filter-chip ${activeFilter === filter ? "active" : ""}`}
                onClick={() => handleFilterChange(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pdp-reviews-list">
        {reviews.length > 0 ? (
          reviews.map((review) => (
            <div key={review.id} className="pdp-review-card">
              <div className="pdp-review-header">
                <div className="pdp-reviewer-info">
                  <span className="pdp-reviewer-name">{review.author}</span>
                  {review.isVerified && (
                    <div className="pdp-verified-badge">
                      <CheckCircleIcon />
                      <span>Verified Buyer</span>
                    </div>
                  )}
                </div>
                <span className="pdp-review-date">{review.date}</span>
              </div>

              <div className="pdp-review-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star}>
                    {star <= review.rating ? (
                      <StarFilledIcon />
                    ) : (
                      <StarEmptyIcon />
                    )}
                  </span>
                ))}
              </div>

              <p className="pdp-review-content">{review.content}</p>

              {/* BỔ SUNG: Hiển thị ảnh của bài đánh giá kèm chức năng Click phóng to */}
              {review.media && review.media.length > 0 && (
                <div
                  className="pdp-media-preview-list"
                  style={{ marginTop: "12px", marginBottom: "12px" }}
                >
                  {review.media.map((m, idx) => (
                    <div
                      key={idx}
                      className="pdp-media-preview-item"
                      style={{ width: "80px", height: "80px" }}
                    >
                      {m.type === "VIDEO" ? (
                        <video
                          src={m.url}
                          className="pdp-preview-img pdp-preview-img-clickable"
                          muted
                          onClick={() =>
                            setExpandedMedia({ url: m.url, type: "VIDEO" })
                          }
                        />
                      ) : (
                        <img
                          src={m.url}
                          alt={`review-img-${idx}`}
                          className="pdp-preview-img pdp-preview-img-clickable"
                          onClick={() =>
                            setExpandedMedia({ url: m.url, type: "IMAGE" })
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ADMIN REPLY */}
              {review.adminReply && (
                <div className="pdp-review-reply pdp-review-reply--admin">
                  <div className="pdp-review-reply-header">
                    <span className="pdp-review-reply-name">
                      HN-Odyssey Team (Quản trị viên)
                    </span>
                    <span className="pdp-review-reply-date">
                      {review.adminReply.date}
                    </span>
                  </div>
                  <p className="pdp-review-reply-content">
                    {review.adminReply.content}
                  </p>
                </div>
              )}

              {/* CUSTOMER REPLIES */}
              {review.customerReplies?.map((cr) => (
                <div
                  key={cr.id}
                  className="pdp-review-reply pdp-review-reply--customer"
                >
                  <div className="pdp-review-reply-header">
                    <span className="pdp-review-reply-name">{cr.author}</span>
                    <span className="pdp-review-reply-date">{cr.date}</span>
                  </div>
                  <p className="pdp-review-reply-content">{cr.content}</p>

                  {/* Ảnh reply khách hàng kèm Click phóng to */}
                  {cr.media && cr.media.length > 0 && (
                    <div
                      className="pdp-media-preview-list"
                      style={{ marginTop: "8px" }}
                    >
                      {cr.media.map((m, idx) => (
                        <div
                          key={idx}
                          className="pdp-media-preview-item"
                          style={{ width: "60px", height: "60px" }}
                        >
                          {m.type === "VIDEO" ? (
                            <video
                              src={m.url}
                              className="pdp-preview-img pdp-preview-img-clickable"
                              muted
                              onClick={() =>
                                setExpandedMedia({ url: m.url, type: "VIDEO" })
                              }
                            />
                          ) : (
                            <img
                              src={m.url}
                              alt={`reply-img-${idx}`}
                              className="pdp-preview-img pdp-preview-img-clickable"
                              onClick={() =>
                                setExpandedMedia({ url: m.url, type: "IMAGE" })
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div className="pdp-review-actions">
                <button
                  className="pdp-reply-action-btn"
                  onClick={() => {
                    handleOpenReply(review.id);
                    setShowReplyEmoji(false);
                  }}
                >
                  Reply
                </button>
                <button
                  className={`pdp-feedback-btn ${userFeedback[review.id] === "like" ? "active" : ""}`}
                  onClick={() => handleFeedback(review.id, "like")}
                >
                  <LikeIcon />
                </button>
                <button
                  className={`pdp-feedback-btn ${userFeedback[review.id] === "dislike" ? "active" : ""}`}
                  onClick={() => handleFeedback(review.id, "dislike")}
                >
                  <DislikeIcon />
                </button>
              </div>

              {replyingTo === review.id && (
                <div className="pdp-reply-input-box">
                  <div style={{ position: "relative" }}>
                    <textarea
                      rows={2}
                      placeholder="Write a reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    {showReplyEmoji && (
                      <div className="pdp-emoji-picker-wrapper">
                        <EmojiPicker
                          onEmojiClick={onReplyEmojiClick}
                          width={320}
                          height={400}
                          searchDisabled={false}
                          emojiStyle={EmojiStyle.NATIVE}
                        />
                      </div>
                    )}
                  </div>

                  {replyMedia.length > 0 && (
                    <div className="pdp-media-preview-list">
                      {replyMedia.map((media, index) => (
                        <div
                          key={index}
                          className="pdp-media-preview-item"
                          style={{ width: "45px", height: "45px" }}
                        >
                          {media.type === "VIDEO" ? (
                            <video
                              src={media.url}
                              className="pdp-preview-img"
                              muted
                            />
                          ) : (
                            <img
                              src={media.url}
                              alt={`upload-${index}`}
                              className="pdp-preview-img"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pdp-reply-input-actions">
                    <div className="pdp-reply-action-left">
                      <input
                        type={`file`}
                        id={`pdp-reply-upload-${review.id}`}
                        multiple
                        accept="image/*,video/*"
                        style={{ display: "none" }}
                        onChange={handleUploadReplyMedia}
                        disabled={
                          isUploadingReplyMedia || replyMedia.length >= 5
                        }
                      />
                      <label
                        htmlFor={`pdp-reply-upload-${review.id}`}
                        className={`pdp-icon-action-btn ${isUploadingReplyMedia || replyMedia.length >= 5 ? "disabled" : ""}`}
                        style={{ padding: "6px 8px" }}
                      >
                        <InlineAttachmentIcon />
                      </label>
                      <button
                        type="button"
                        className="pdp-icon-action-btn"
                        style={{ padding: "6px 8px" }}
                        onClick={() => setShowReplyEmoji(!showReplyEmoji)}
                      >
                        <InlineEmojiIcon />
                      </button>
                    </div>

                    <div className="pdp-reply-action-right">
                      <button
                        className="pdp-form-cancel"
                        onClick={() => {
                          handleCloseReply();
                          setShowReplyEmoji(false);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="pdp-form-submit"
                        onClick={() => {
                          handleSubmitCustomerReply(review.id);
                          setShowReplyEmoji(false);
                        }}
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <p style={{ textAlign: "center", color: "#666" }}>
            No reviews found for this filter.
          </p>
        )}
      </div>

      {totalPages > 0 && (
        <div className="pdp-reviews-pagination">
          <ProductPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* KHUNG MODAL ZOOM ẢNH SỬ DỤNG PORTAL ĐỂ THOÁT KHỎI LAYOUT ẨN */}
      {expandedMedia &&
        createPortal(
          <div
            className="pdp-media-modal-overlay"
            onClick={() => setExpandedMedia(null)}
          >
            <div
              className="pdp-media-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="pdp-media-modal-close"
                onClick={() => setExpandedMedia(null)}
              >
                &times;
              </button>
              {expandedMedia.type === "VIDEO" ? (
                <video src={expandedMedia.url} controls autoPlay />
              ) : (
                <img src={expandedMedia.url} alt="Expanded view" />
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
