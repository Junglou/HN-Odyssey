// imports
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HeartIcon,
  HeartFilledIcon,
  CartIcon,
} from "../../assets/icons/ProductIcons";
import type { ProductItem } from "../../hooks/products/useProductList";
import "./ProductCard.css";

// component
export default function ProductCard({ product }: { product: ProductItem }) {
  const navigate = useNavigate();
  const [isWishlisted, setIsWishlisted] = useState(false);

  const handleCardClick = () => {
    navigate(`/products/${product.id}`);
  };

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsWishlisted((prev) => !prev);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: add to cart logic
  };

  // render
  return (
    <div
      className="pl-product-card"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleCardClick()}
    >
      <div className="pl-card-image-wrap">
        <div
          className="pl-card-image-bg"
          style={{ backgroundImage: `url(${product.imageUrl})` }}
        ></div>
        <button
          className={`pl-card-heart ${isWishlisted ? "wishlisted" : ""}`}
          onClick={handleHeartClick}
          aria-label="Save to wishlist"
        >
          {isWishlisted ? <HeartFilledIcon /> : <HeartIcon />}
        </button>
      </div>

      <div className="pl-card-info">
        <h3 className="pl-card-name">{product.name}</h3>
        <p className="pl-card-desc">{product.desc}</p>
        <div className="pl-card-line"></div>

        <div className="pl-card-footer">
          <span className="pl-card-price">${product.price}</span>
          <button className="pl-card-add-btn" onClick={handleAddToCart}>
            <span>Add to Cart</span>
            <CartIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
