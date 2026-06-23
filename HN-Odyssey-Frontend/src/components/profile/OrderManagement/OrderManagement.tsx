import { useRef, useState } from "react";
import "./OrderManagement.css";
import type { UserOrder } from "../../../types/user";
import RecommendationList from "../../common/RecommendationList";
import type { RecommendProduct } from "../../../hooks/profile/useRecommendProduct";
import OrderBox from "./OrderManagementBox";
import { ArrowDownIcon } from "../../../assets/icons/CheckoutIcons";
import { useClickOutside } from "../../../hooks/common/useClickOutside";

interface OrderManagementProps {
  // Support either prop name `order` (existing) or `orders` (future-proof)
  order?: UserOrder[];
  orders?: UserOrder[];
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    totalFiltered: number;
    startIndex: number;
  };
  onPageChange?: (page: number) => void;
  statusFilter?: string;
  onStatusChange?: (status: string | "All") => void;
  recommendations: RecommendProduct[];
}

const FILTER_OPTIONS = [
  "All",
  "Pending",
  "Processing",
  "Delivering",
  "Delivered",
  "Canceled",
] as const;

const OrderManagement = ({
  order,
  orders,
  pagination,
  onPageChange,
  statusFilter,
  onStatusChange,
  recommendations,
}: OrderManagementProps) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useClickOutside(filterRef, () => setIsFilterOpen(false));

  const ordersList = order ?? orders ?? [];
  const currentFilter = statusFilter ?? "All";

  return (
    <div className="my-order-card order-management-layout profile-ultra-wide-grid-card">
      <div className="order-header">
        <h1 className="order-title">Order Management</h1>
        <div
          ref={filterRef}
          className="filter-container"
          onClick={() => setIsFilterOpen((prev) => !prev)}
        >
          <input
            type="text"
            className="filter-box"
            value={currentFilter}
            placeholder="Status"
            readOnly
            aria-label="Filter by status"
            aria-expanded={isFilterOpen}
            style={{ cursor: "pointer" }}
          />
          <ArrowDownIcon
            className={`order-filter-select-icon ${isFilterOpen ? "open" : ""}`}
          />
          {isFilterOpen && (
            <div
              className="order-filter-dropdown-list"
              role="listbox"
              aria-label="Status options"
            >
              {FILTER_OPTIONS.map((status) => (
                <div
                  key={status}
                  role="option"
                  aria-selected={currentFilter === status}
                  className={`order-filter-dropdown-item ${currentFilter === status ? "active" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onStatusChange?.(status);
                    setIsFilterOpen(false);
                  }}
                >
                  {status}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="order-box-internal-grid">
        {/* CỘT 1: Box quản lý đơn hàng */}
        <div className="grid-section section-order">
          {ordersList.map((orderItem) => (
            <OrderBox key={orderItem.id} id={orderItem.id} order={orderItem} />
          ))}
          {ordersList.length === 0 && (
            <div className="no-orders">No orders found.</div>
          )}

          {/* Pagination placed inside the order column and spanning the grid */}
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
                of {pagination.totalFiltered} orders
              </span>
            </div>
          )}
        </div>

        {/* CỘT 2: RECOMMENDATIONS */}
        <div className="grid-section section-recs">
          <RecommendationList products={recommendations} />
        </div>
      </div>
    </div>
  );
};

export default OrderManagement;
