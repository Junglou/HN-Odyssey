import "./OrderManagement.css";
import type { UserProfile, ProductRecommendation, UserOrder } from "../../../types/user";
import RecommendationList from "../../common/RecommendationList";
import OrderBox from "./OrderManagementBox";

interface OrderManagementProps {
  user: UserProfile;
  recommendations: ProductRecommendation[];
  order: UserOrder[];
}

const OrderManagement = ({
  recommendations,
  order

}: OrderManagementProps) => {

  return (
    <div className="my-order-card">
      <div className="order-header">
        <h1 className="order-title">Order Management</h1>
        <div className="filter-container">
          <select className="filter-box" name="filter" id="filter">
            <option value="All">All</option>
            <option value="Confirm">Confirm</option>
            <option value="Shipping">Shipping</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="order-box-internal-grid">
        {/* CỘT 1: Box quản lý đơn hàng */}
        <div className="grid-section section-order">
          {
            order.map((order, index) => (
              <OrderBox id={(index+1).toString()} address={order.address} order={order} />
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

export default OrderManagement;
