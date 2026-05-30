import { Link } from 'react-router-dom';
import type { UserAddress, UserOrder } from "../../../types/user";
import "./PurchaseHistoryBox.css";

interface HistoryBoxProp {
  id: string,
  address: UserAddress;
  order: UserOrder;
}

const PurchaseBox = ({id, address, order}:HistoryBoxProp) => {
  
  return (
    <div className="box-container">

      <div className="box-content">
        <div className="box-infor">
          <div className="title-container">
            <span className="lbl-text">Order#{id}</span>
            <div className="address-container">
              <span>{address.address}, {address.country}</span>
            </div>
          </div>
          
          <div className="order-thumbnail-container">
            <div className="thumbnail-img-container">
              <img src={order.product[0].image} className="order-img" />
            </div>
            <div className="thumbnail-detail-container">
              <span className="lbl-thumb-text">{order.product[0].name}</span>
              <div className="des-container">
                <span className="span-text">
                  <strong>Description:</strong> 
                  {order.product[0].description}
                </span>
              </div>
              <div className="price-container">
                <span className="span-text">
                  <strong>Price:</strong> 
                  {order.product[0].price}
                </span>
              </div>
            </div>
          </div>

          <div className="view-detail-link-container">
            <Link to="/profile/orders/detail" className="view-detail-link">View detail</Link>
          </div>

          <div className="total-price-text">
            <span className="span-text">Total Price: {order.product[0].price}</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default PurchaseBox;
