import "./OrderDetail.css";
import type { UserProfile } from "../../../types/user";
import OrderShipping from "./OrderShipping";

interface OrderDetailProps {
  user: UserProfile;
}

const OrderDetail= ({
  user

}: OrderDetailProps) => {

  return (
    <div className="my-detail-card">
      <div className="detail-header">
        <h1 className="detail-title">Order Management</h1>
      </div>

      <div className="detail-box-internal-grid">
        {/* CỘT 1: Đơn hàng */}
        <div className="grid-section section-detail">
          <div className="order-detail-container">

            <div className="order-detail">
              <div className="order-title">
                <span className="lbl-text">Order</span>
              </div>
              <div>
                <span className="lbl-text">Order information</span>
              </div>
              <div className="order-detail-information-container">
                <div className="order-detail-information-lbl">
                  <span className="lbl-text">Name:</span>
                  <span className="lbl-text">Phone:</span>
                  <span className="lbl-text">Email:</span>
                  <span className="lbl-text">Order date:</span>
                  <span className="lbl-text">Ship date:</span>
                  <span className="lbl-text">Ship to:</span>
                </div>
                <div className="order-detail-information-txt">
                  <span>{user.username}</span>
                  <span>{user.phone}</span>
                  <span>{user.email}</span>
                  <span>{user.userOrders[0].orderDate}</span>
                  <span>{user.userOrders[0].shipDate}</span>
                  <span>{user.userOrders[0].address.address}, {user.userOrders[0].address.city}</span>
                </div>
              </div>
              <div className="order-total-container">
                <div className="order-total-lbl">
                  <span className="lbl-text">Subtotal</span>
                  <span className="lbl-text">Ship fee:</span>
                  <span className="lbl-text">Total:</span>
                </div>
                <div className="order-total-txt">
                  <span>125.99$</span>
                  <span>{user.userOrders[0].shipFee}</span>
                  <span>135.99$</span>
                </div>
              </div>
            </div>
            <div className="order-product-container">
              <div className="order-product-lbl">
                <span className="lbl-text">Order item</span>
              </div>
              {user.userOrders[0].product.map((product, index) => (
                <div className="order-product">
                  <div className="thumbnail-img-container">
                    <img src={product.image} className="order-img" />
                  </div>
                  <div className="thumbnail-detail-container">
                    <span className="lbl-thumb-text">{product.name}</span>
                    <div className="des-container">
                      <span className="span-text">
                        <strong>Description: </strong> 
                        {product.description}
                      </span>
                    </div>
                    <div className="price-container">
                      <span className="span-text">
                        <strong>Price: </strong> 
                        {product.price}$
                      </span>
                      <span>x{(index+1).toString()}</span>
                    </div>
                  </div>
                </div>
              ))}
              
            </div>
          </div>
        </div>
        {/* Cột 2: Shipping track */}
        <div className="grid-section section-shipping">
          <OrderShipping/>
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;
