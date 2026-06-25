import { Link } from "react-router-dom";
import {
  getOrderLineItems,
  getOrderShippingAddress,
  type UserOrder,
} from "../../../types/user";
import "./OrderManagementBox.css";

interface OrderBoxProp {
  id: string;
  order: UserOrder;
}

// Thêm hàm formatMoney để dùng chung
const formatMoney = (value?: number) => {
  const safeValue = typeof value === "number" && !isNaN(value) ? value : 0;
  return `$${safeValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const OrderManagementBox = ({ id: orderId, order }: OrderBoxProp) => {
  const detailRouteId = order.id || order.orderCode || orderId;

  const lineItems = getOrderLineItems(order);
  const primary = lineItems[0];
  const shippingAddress = getOrderShippingAddress(order);

  return (
    <div className="order-box-container">
      <div className="box-content">
        <div className="box-infor">
          <div className="title-container">
            <span
              className="lbl-text order-box-position-label"
              aria-hidden="true"
            />
            <div className="address-container">
              <span>{shippingAddress}</span>
            </div>
          </div>

          {primary && (
            <div className="order-thumbnail-container">
              <div className="thumbnail-img-container">
                <img src={primary.image} className="order-img" alt="" />
              </div>
              <div className="thumbnail-detail-container">
                <span className="lbl-thumb-text">{primary.name}</span>
                {primary.description ? (
                  <div className="des-container">
                    <span className="span-text">
                      <strong>Description: </strong>
                      {primary.description}
                    </span>
                  </div>
                ) : null}
                <div className="price-container">
                  <span className="span-text">
                    <strong>Price: </strong>
                    {/* Bọc formatMoney tại đây */}
                    {formatMoney(primary.price)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="order-box-footer-row">
            <span className="span-text total-price-text">
              {/* Bọc formatMoney tại đây */}
              Total Price: {formatMoney(order.totalAmount)}
            </span>
            <Link
              to={`/profile/orders/detail/${encodeURIComponent(detailRouteId)}`}
              className="view-detail-link"
            >
              View detail
            </Link>
          </div>

          <div className="status">
            <span className="span-text">Status: {order.statusLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderManagementBox;
