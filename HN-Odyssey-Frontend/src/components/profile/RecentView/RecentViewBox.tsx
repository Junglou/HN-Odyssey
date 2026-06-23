import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Product } from "../../../types/product";
import "./RecentViewBox.css";

interface RecentViewBoxProps {
  product: Product;
  onRecordView?: (product: Product) => void;
  onRemove?: () => void; // FIX: Bổ sung prop onRemove để giải quyết lỗi TypeScript
}

const RecentViewBox = ({
  product,
  onRecordView,
  onRemove,
}: RecentViewBoxProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    onRecordView?.(product);
  }, [onRecordView, product]);

  const handleAddToCart = () => {
    // Chuyển hướng đến trang chi tiết sản phẩm để người dùng xem thông tin và chọn phân loại trước khi Add to cart
    navigate(`/products/${product.id}`);
  };

  return (
    <div className="box-container">
      <div className="box-content">
        <div className="box-infor">
          <div className="order-thumbnail-container">
            <div className="thumbnail-img-container">
              <img
                src={product.image}
                className="order-img"
                alt={product.name}
              />
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
                  {product.price}$
                </span>
              </div>
            </div>
          </div>

          <div className="recent-view-btn-container">
            <button
              type="button"
              className="recent-view-edit-btn"
              onClick={onRemove} // Gắn sự kiện Remove
            >
              Remove
            </button>
            <button
              type="button"
              className="recent-view-remove-btn"
              onClick={handleAddToCart} // Gắn sự kiện Add to cart
            >
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecentViewBox;
