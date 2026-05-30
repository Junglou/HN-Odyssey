import "./RecentView.css";
import type { Product } from "../../../types/product";
import RecommendationList from "../../common/RecommendationList";
import RecentViewBox from "./RecentViewBox";

interface RecentViewProps {
  recommendations: Product[];
}

const RecentView = ({
  recommendations,

}: RecentViewProps) => {

  return (
    <div className="recent-card">
      <div className="recent-header">
        <h1 className="recent-title">Recently Viewed</h1>
      </div>

      <div className="recent-internal-grid">
        {/* CỘT 1: Box quản lý đơn hàng */}
        <div className="grid-section section-recent">
          {
            recommendations.map((product) => (
              <RecentViewBox product={product}/>
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

export default RecentView;
