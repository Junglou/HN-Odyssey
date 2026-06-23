import "./MyCoupon.css";
import type { CustomerCoupon } from "../../../hooks/profile/useCouponManagement";
import RecommendationList from "../../common/RecommendationList";
import type { RecommendProduct } from "../../../hooks/profile/useRecommendProduct";
import MyCouponBox from "./MyCouponBox";

interface MyCouponProps {
  coupons: CustomerCoupon[];
  recommendations: RecommendProduct[];
}

const MyCoupon = ({ coupons, recommendations }: MyCouponProps) => {
  const visibleCoupons = coupons.filter((coupon) => coupon.status !== "Draft");

  return (
    <div className="coupon-card">
      <div className="coupon-header">
        <h1 className="coupon-title">Coupon Management</h1>
      </div>

      <div className="coupon-internal-grid">
        <div className="grid-section section-coupon">
          {visibleCoupons.map((coupon) => (
            <MyCouponBox key={coupon.id} coupon={coupon} />
          ))}
          {visibleCoupons.length === 0 && (
            <div className="no-coupons">No coupons available.</div>
          )}
        </div>

        <div className="grid-section section-recs">
          <RecommendationList products={recommendations} />
        </div>
      </div>
    </div>
  );
};

export default MyCoupon;
