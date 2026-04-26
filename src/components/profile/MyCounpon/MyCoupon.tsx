import "./MyCoupon.css";
import type { Product } from "../../../types/product";
import type { Coupon } from "../../../types/coupon";
import RecommendationList from "../../common/RecommendationList";
import MyCouponBox from "./MyCouponBox";

interface RecentViewProps {
  recommendations: Product[];
  coupons: Coupon[];
}

const MyCoupon = ({
  recommendations,
  coupons,
}: RecentViewProps) => {
  return (
    <div className="recent-card">
      <div className="recent-header">
        <h1 className="recent-title">Coupon Management</h1>
      </div>

      <div className="recent-internal-grid">
        {/* CỘT 1: Coupon của người dùng */}
        <div className="grid-section section-recent">
          {coupons.map((coupon) => (
            <MyCouponBox key={coupon.id} coupon={coupon} />
          ))}
        </div>

        {/* CỘT 2: RECOMMENDATIONS */}
        <div className="grid-section section-recs">
          <RecommendationList products={recommendations} />
        </div>
      </div>
    </div>
  );
};

export default MyCoupon;
