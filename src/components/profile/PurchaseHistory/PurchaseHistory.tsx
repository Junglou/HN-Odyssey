import "./PurchaseHistory.css";
import type { UserOrder } from "../../../types/user";
import type { Product } from "../../../types/product";
import RecommendationList from "../../common/RecommendationList";
import PurchaseBox from "./PurchaseHistoryBox";

interface HistoryProps {
  recommendations: Product[];
  order: UserOrder[];
}

const PurchaseHistory = ({
  recommendations,
  order

}: HistoryProps) => {

  return (
    <div className="history-card">
      <div className="history-header">
        <h1 className="history-title">Purchase History</h1>
      </div>

      <div className="history-internal-grid">
        {/* CỘT 1: Box quản lý đơn hàng */}
        <div className="grid-section section-history">
          {
            order.map((order, index) => (
              <PurchaseBox id={(index+1).toString()} address={order.address} order={order} />
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

export default PurchaseHistory;
