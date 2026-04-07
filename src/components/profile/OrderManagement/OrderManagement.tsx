import { useMemo, useState } from "react";
import "./OrderManagement.css";
import type { UserOrder } from "../../../types/user";
import RecommendationList from "../../common/RecommendationList";
import OrderBox from "./OrderManagementBox";
import type { Product } from "../../../types/product";

interface OrderManagementProps {
  recommendations: Product[];
  order: UserOrder[];
}

const OrderManagement = ({
  recommendations,
  order,
}: OrderManagementProps) => {
  const [filter, setFilter] = useState("All");

  const filteredOrders = useMemo(
    () =>
      order.filter((orderItem) =>
        filter === "All" ? true : orderItem.status === filter,
      ),
    [order, filter],
  );

  return (
    <div className="my-order-card">
      <div className="order-header">
        <h1 className="order-title">Order Management</h1>
        <div className="filter-container">
          <select
            className="filter-box"
            name="filter"
            id="filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="All">All</option>
            <option value="Confirming">Confirming</option>
            <option value="Shipping">Shipping</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="order-box-internal-grid">
        {/* CỘT 1: Box quản lý đơn hàng */}
        <div className="grid-section section-order">
          {filteredOrders.map((orderItem, index) => (
            <OrderBox
              key={`${orderItem.orderDate}-${index}`}
              id={(index + 1).toString()}
              address={orderItem.address}
              order={orderItem}
            />
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

export default OrderManagement;
