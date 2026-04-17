import "./TopCouponsTable.css";
import type { CouponData } from "../../../../hooks/portal/Dashboard/MarketingAndPromotion/useMarketingAndPromotion";

interface TopCouponsTableProps {
  coupons: CouponData[];
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export default function TopCouponsTable({
  coupons,
  currentPage = 1,
  totalPages = 1,
  onPageChange = () => {},
}: TopCouponsTableProps) {
  return (
    <div className="tc-wrapper">
      <div className="tc-section-title">Top Performing Coupons</div>
      <div className="tc-table-wrapper">
        {!coupons || coupons.length === 0 ? (
          <div className="tc-empty-state">
            không có dữ liệu mã giảm giá nào trong khoảng thời gian này
          </div>
        ) : (
          <>
            <table className="tc-table">
              <thead>
                <tr>
                  <th>Coupon Code</th>
                  <th>Description</th>
                  <th className="tc-col-right">Usage Count</th>
                  <th className="tc-col-right">Total Discount</th>
                  <th className="tc-col-right">Revenue Generated</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td className="tc-code-cell">{coupon.code}</td>
                    <td>{coupon.description}</td>
                    <td className="tc-col-right">{coupon.usageCount}</td>
                    <td className="tc-col-right">{coupon.totalDiscount}</td>
                    <td className="tc-col-right">{coupon.revenueGenerated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="tc-pagination-container">
              <button
                className="tc-page-nav-btn"
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
              >
                Previous
              </button>

              <div className="tc-page-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      className={`tc-page-num-btn ${
                        currentPage === page ? "tc-active" : ""
                      }`}
                      onClick={() => onPageChange(page)}
                    >
                      {page}
                    </button>
                  ),
                )}
              </div>

              <button
                className="tc-page-nav-btn"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
