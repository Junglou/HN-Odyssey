// imports
import { useProductReviews } from "../../hooks/productDetail/useProductReviews";
import {
  StarFilledIcon,
  CheckCircleIcon,
} from "../../assets/icons/ProductDetailIcons";
import ProductPagination from "../products/ProductPagination";
import "./ProductReviews.css";

// component
export default function ProductReviews() {
  // hooks
  const {
    reviews,
    activeFilter,
    sortBy,
    currentPage,
    totalPages,
    handleFilterChange,
    handleSortChange,
    handlePageChange,
  } = useProductReviews();

  // config
  const filters = ["All", "5 Stars", "4 Stars", "3 Stars", "Comfort", "Value"];

  // render
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
          <button className="pdp-write-btn">Write a review</button>
        </div>
      </div>

      <div className="pdp-reviews-toolbar">
        <div className="pdp-sort-box">
          <span className="pdp-toolbar-label">Sort by:</span>
          <select
            className="pdp-sort-select"
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
          >
            <option value="Most recent">Most recent</option>
            <option value="Highest Rating">Highest Rating</option>
            <option value="Lowest Rating">Lowest Rating</option>
          </select>
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
        {reviews.map((review) => (
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
              {Array.from({ length: review.rating }).map((_, i) => (
                <StarFilledIcon key={i} />
              ))}
            </div>

            <p className="pdp-review-content">{review.content}</p>

            <div className="pdp-review-actions">
              <button className="pdp-feedback-btn">👍</button>
              <button className="pdp-feedback-btn">👎</button>
            </div>
          </div>
        ))}
      </div>

      <div className="pdp-reviews-pagination">
        <ProductPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
