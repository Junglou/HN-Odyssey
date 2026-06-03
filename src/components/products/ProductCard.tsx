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
  // 1. CẬP NHẬT: Truyền thêm product.sku vào Hook và lấy thêm cờ loading
  const {
    isWishlisted,
    handleCardClick,
    handleHeartClick,
    handleAddToCart,
    isAddingToCart,
    isTogglingWishlist,
  } = useProductCard(
    product.id,
    product.slug,
    product.sku,
    product.hasVariants,
    product.initialWishlisted,
  );

  // render
  return (
    <div className="pl-product-card">
      <div className="pl-card-image-wrap">
        {/* di chuyển sự kiện điều hướng vào ảnh để tránh bọc nút bấm bên trong một nút bấm khác */}
        <div
          className="pl-card-image-bg"
          style={{ backgroundImage: `url(${product.imageUrl})` }}
          onClick={handleCardClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleCardClick()}
          aria-label={`Xem chi tiết sản phẩm ${product.name}`}
        ></div>

        {/* hiển thị nhãn phần trăm giảm giá nếu có */}
        {product.discountBadge && (
          <div className="pl-card-discount-badge">{product.discountBadge}</div>
        )}

        {/* 2. CẬP NHẬT: Vô hiệu hóa nút thả tim khi đang call API */}
        <button
          className={`pl-card-heart ${isWishlisted ? "wishlisted" : ""}`}
          onClick={handleHeartClick}
          disabled={isTogglingWishlist}
          aria-label="Save to wishlist"
        >
          {isWishlisted ? <HeartFilledIcon /> : <HeartIcon />}
        </button>
      </div>

      <div className="pl-card-info">
        {/* gắn sự kiện điều hướng vào tên sản phẩm giúp người dùng dễ thao tác */}
        <h3
          className="pl-card-name"
          onClick={handleCardClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleCardClick()}
        >
          {product.name}
        </h3>
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

          {/* 3. CẬP NHẬT: Đổi Text và vô hiệu hóa nút Add khi đang gọi API */}
          <button
            className="pl-card-add-btn"
            onClick={handleAddToCart}
            disabled={isAddingToCart}
          >
            <span>
              {isAddingToCart
                ? "Adding..."
                : product.hasVariants
                  ? "Select Options"
                  : "Add to Cart"}
            </span>
            <CartIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
