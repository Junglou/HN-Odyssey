import type { ProductRecommendation } from "../../../types/user";
import "./RecentViewBox.css";

interface MyWishlistProp {
  product: ProductRecommendation;
}

const WishlistBox = ({product}:MyWishlistProp) => {
  
  return (
    <div className="box-container">

      <div className="box-content">
        <div className="box-infor">  
          <div className="order-thumbnail-container">
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
                  {product.price}
                </span>
              </div>
            </div>
          </div>

          <div className="btn-container">
            <button className="edit-btn">Remove</button>
            <button className="remove-btn">Add to cart</button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default WishlistBox;
