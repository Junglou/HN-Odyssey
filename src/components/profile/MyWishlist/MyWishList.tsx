import "./MyWishlist.css";
import type { UserProfile, ProductRecommendation, UserOrder } from "../../../types/user";
import RecommendationList from "../../common/RecommendationList";
import WishlistBox from "./MyWishlistBox";

interface MyWishlistProps {
  user: UserProfile;
  recommendations: ProductRecommendation[];
  order: UserOrder[];
}

const MyWishlist = ({
  recommendations,

}: MyWishlistProps) => {

  return (
    <div className="history-card">
      <div className="history-header">
        <h1 className="history-title">Order Management</h1>
      </div>

      <div className="history-internal-grid">
        {/* CỘT 1: Box quản lý đơn hàng */}
        <div className="grid-section section-history">
          {
            recommendations.map((product) => (
              <WishlistBox product={product}/>
            ))
          }
        </div>

        {/* CỘT 2: RECOMMENDATIONS */}
        <div className="grid-section section-recs">
          <RecommendationList products={recommendations} />
        </div>
      </div>
    </div>
  );
};

export default MyWishlist;
