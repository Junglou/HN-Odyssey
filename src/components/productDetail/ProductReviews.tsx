// imports
import { useState, useRef, useEffect } from "react";
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
import "./ProductReviews.css";

// components
function CustomDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
}) {
  // states
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // hooks
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

  // render
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

// render
export default function ProductReviews() {
  // hooks
  const {
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

  return (
    <div className="pdp-reviews-section">
      <h2 className="pdp-reviews-heading">Reviews & Ratings</h2>

      <div className="pdp-reviews-overview">
        <div className="pdp-rating-score-box">
          <span className="pdp-rating-big">4.9/5</span>
          <div className="pdp-stars-row">
            <StarFilledIcon />
            <StarFilledIcon />
            <StarFilledIcon />
            <StarFilledIcon />
            <StarFilledIcon />
          </div>
          <span className="pdp-review-count">Based on 51 reviews</span>
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
          <textarea
            className="pdp-review-textarea"
            placeholder="What did you like or dislike? How did it fit?"
            rows={4}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
          ></textarea>
          <div className="pdp-form-actions">
            <button className="pdp-form-cancel" onClick={handleCancelReview}>
              Cancel
            </button>
            <button className="pdp-form-submit" onClick={handleSubmitReview}>
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

              {/* phần render nội dung phản hồi từ quản trị viên */}
              {review.reply && (
                <div className="pdp-review-reply">
                  <div className="pdp-review-reply-header">
                    <span className="pdp-review-reply-name">
                      HN-Odyssey Team
                    </span>
                    <span className="pdp-review-reply-date">
                      {review.reply.date}
                    </span>
                  </div>
                  <p className="pdp-review-reply-content">
                    {review.reply.content}
                  </p>
                </div>
              )}

              <div className="pdp-review-actions">
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
    </div>
  );
}
