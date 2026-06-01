import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { Product } from "../../../types/product";
import "./RecentViewBox.css";

interface RecentViewBoxProps {
  product: Product;
  onRecordView?: (product: Product) => void;
}

const RecentViewBox = ({ product, onRecordView }: RecentViewBoxProps) => {
  useEffect(() => {
    onRecordView?.(product);
  }, [onRecordView, product]);

  return (
    <div className="box-container">
      <div className="box-content">
        <div className="box-infor">
          <div className="order-thumbnail-container">
            <div className="thumbnail-img-container">
              <img src={product.image} className="order-img" alt="" />
            </div>
            <div className="thumbnail-detail-container">
              <Link
                to={`/products/${product.id}`}
                className="lbl-thumb-text"
                onClick={() => onRecordView?.(product)}
              >
                {product.name}
              </Link>
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

          <div className="recent-view-btn-container">
            <button type="button" className="recent-view-edit-btn">
              Remove
            </button>
            <button type="button" className="recent-view-remove-btn">
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecentViewBox;
