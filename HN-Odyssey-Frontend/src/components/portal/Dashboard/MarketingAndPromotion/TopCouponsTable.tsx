import "./TopCouponsTable.css";
import type { CouponData } from "../../../../hooks/portal/Dashboard/MarketingAndPromotion/useMarketingAndPromotion";
import PortalPagination from "../../common/Pagination/PortalPagination";

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
  const hasData = Array.isArray(coupons) && coupons.length > 0;

  return (
    <div className="tc-wrapper">
      <div className="tc-section-title">Top Performing Coupons</div>
      <div className="tc-table-wrapper">
        {!hasData ? (
          <div className="tc-empty-state">
            No coupons were used in this period
          </div>
        ) : (
          <>
            <table className="tc-table">
              <thead>
                <tr>
                  <th>Coupon Code</th>
                  <th>Description</th>
                  <th
                    className="tc-col-right"
                    title="Times applied at checkout"
                  >
                    Applied
                  </th>
                  <th
                    className="tc-col-right"
                    title="Completed orders using this code"
                  >
                    Orders
                  </th>
                  <th className="tc-col-right">Total Discount</th>
                  <th className="tc-col-right">Revenue Generated</th>
                  <th className="tc-col-right" title="Discount cost ÷ revenue">
                    Cost / Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td className="tc-code-cell">{coupon.code}</td>
                    <td>{coupon.description}</td>
                    <td className="tc-col-right">{coupon.appliedCount}</td>
                    <td className="tc-col-right">{coupon.orderCount}</td>
                    <td className="tc-col-right">{coupon.totalDiscount}</td>
                    <td className="tc-col-right">{coupon.revenueGenerated}</td>
                    <td className="tc-col-right">{coupon.costRatio}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="tc-pagination-container">
              <PortalPagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={onPageChange}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
