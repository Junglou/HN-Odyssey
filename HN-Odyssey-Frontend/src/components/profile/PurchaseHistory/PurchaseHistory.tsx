import "../OrderManagement/OrderManagement.css";
import type { UserOrder } from "../../../types/user";
import RecommendationList from "../../common/RecommendationList";
import type { RecommendProduct } from "../../../hooks/profile/useRecommendProduct";
import OrderBox from "../OrderManagement/OrderManagementBox";

interface HistoryProps {
  order: UserOrder[];
  recommendations: RecommendProduct[];
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    totalFiltered: number;
    startIndex: number;
  };
  onPageChange?: (page: number) => void;
}

const PurchaseHistory = ({
  order,
  recommendations,
  pagination,
  onPageChange,
}: HistoryProps) => {
  return (
    <div className="my-order-card order-management-layout profile-ultra-wide-grid-card">
      <div className="order-header">
        <h1 className="order-title">Purchase History</h1>
      </div>

      <div className="order-box-internal-grid">
        <div className="grid-section section-order">
          {order.map((orderItem) => (
            <OrderBox key={orderItem.id} id={orderItem.id} order={orderItem} />
          ))}

          {order.length === 0 && (
            <div className="no-orders">No purchases found.</div>
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
                of {pagination.totalFiltered} purchases
              </span>
            </div>
          )}
        </div>

        <div className="grid-section section-recs">
          <RecommendationList products={recommendations} />
        </div>
      </div>
    </div>
  );
};

export default PurchaseHistory;
