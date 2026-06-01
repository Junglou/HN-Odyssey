import "./RecentView.css";
import type { Product } from "../../../types/product";
import RecommendationList from "../../common/RecommendationList";
import type { RecommendProduct } from "../../../hooks/profile/useRecommendProduct";
import { recordRecentViewProduct } from "../../../hooks/profile/useRecentViewManagement";
import RecentViewBox from "./RecentViewBox";

interface RecentViewProps {
  recentView: Product[];
  recommendations: RecommendProduct[];
  loading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    totalFiltered: number;
    startIndex: number;
  };
  onPageChange?: (page: number) => void;
}

const RecentView = ({
  recentView,
  recommendations,
  loading = false,
  pagination,
  onPageChange,
}: RecentViewProps) => {
  return (
    <div className="my-order-card order-management-layout profile-ultra-wide-grid-card">
      <div className="order-header">
        <h1 className="order-title">Recently Viewed</h1>
      </div>

      <div className="order-box-internal-grid">
        <div className="grid-section section-order section-recent">
          {recentView.map((product) => (
            <RecentViewBox
              key={`${product.id}-${product.variantId ?? "default"}`}
              product={product}
              onRecordView={recordRecentViewProduct}
            />
          ))}

          {!loading && recentView.length === 0 && (
            <div className="no-recent-view">
              You have not viewed any products yet.
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="order-pagination">
              <div className="order-page-numbers">
                <button
                  type="button"
                  className="order-page-num"
                  disabled={pagination.page === 1}
                  onClick={() => onPageChange?.(pagination.page - 1)}
                >
                  &lt;
                </button>
                {Array.from(
                  { length: pagination.totalPages },
                  (_, i) => i + 1,
                ).map((num) => (
                  <button
                    type="button"
                    key={num}
                    className={`order-page-num ${pagination.page === num ? "active" : ""}`}
                    onClick={() => onPageChange?.(num)}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  className="order-page-num"
                  disabled={
                    pagination.page === pagination.totalPages ||
                    pagination.totalPages === 0
                  }
                  onClick={() => onPageChange?.(pagination.page + 1)}
                >
                  &gt;
                </button>
              </div>
              <span className="order-pagination-info">
                Showing{" "}
                {pagination.totalFiltered === 0 ? 0 : pagination.startIndex + 1}{" "}
                to{" "}
                {Math.min(
                  pagination.startIndex + pagination.limit,
                  pagination.totalFiltered,
                )}{" "}
                of {pagination.totalFiltered} items
              </span>
            </div>
          )}
        </div>

        <div className="grid-section section-recs profile-recommendations">
          <RecommendationList products={recommendations} />
        </div>
      </div>
    </div>
  );
};

export default RecentView;
