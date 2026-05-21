// imports
import {
  HeartIcon,
  HeartFilledIcon,
  CartIcon,
} from "../../assets/icons/ProductIcons";
import type { ProductItem } from "../../hooks/products/useProductList";
import { useProductCard } from "../../hooks/products/useProductCard";
import "./ProductCard.css";

// component
export default function ProductCard({ product }: { product: ProductItem }) {
  // Nhận toàn bộ state và handlers từ hook, truyền id vào để hook sử dụng
  const { isWishlisted, handleCardClick, handleHeartClick, handleAddToCart } =
    useProductCard(product.id);

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

        {/* hiển thị nhãn phần trăm giảm giá nếu có */}
        {product.discountBadge && (
          <div className="pl-card-discount-badge">{product.discountBadge}</div>
        )}

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
          {/* khu vực hiển thị giá có xét điều kiện khuyến mãi */}
          <div className="pl-card-price-container">
            {product.originalPrice && product.originalPrice > product.price ? (
              <>
                <span className="pl-card-price-old">
                  ${product.originalPrice}
                </span>
                <span className="pl-card-price-new">${product.price}</span>
              </>
            ) : (
              <span className="pl-card-price">${product.price}</span>
            )}
          </div>

          <button className="pl-card-add-btn" onClick={handleAddToCart}>
            <span>Add to Cart</span>
            <CartIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
