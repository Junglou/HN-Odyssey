import type { Product } from "../../../types/product";
import "./MyWishlistBox.css";

interface MyWishlistProp {
  product: Product;
  onDelete: () => void;
}

const WishlistBox = ({ product, onDelete }: MyWishlistProp) => {
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

          <div className="my-wishlist-btn-container">
            <button className="my-wishlist-edit-btn" onClick={onDelete}>
              Remove
            </button>
            <button className="my-wishlist-remove-btn">Add to cart</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WishlistBox;
