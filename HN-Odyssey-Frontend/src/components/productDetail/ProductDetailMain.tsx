import { useState, useEffect } from "react";
import { useProductDetailMain } from "../../hooks/productDetail/useProductDetailMain";
import {
  HeartEmptyIcon,
  HeartFilledIcon,
} from "../../assets/icons/ProductDetailIcons";
import type { ProductDetailState } from "../../hooks/productDetail/useProductDetail";
import "./ProductDetailMain.css";

interface ProductDetailMainProps {
  product: ProductDetailState;
  selectedOptions: Record<string, string>;
  activeImageIndex: number;
  quantity: number | string;
  onOptionChange: (code: string, value: string) => void;
  onImageChange: (index: number) => void;
  onQuantityChange: (type: "inc" | "dec") => void;
  onQuantityInput: (val: string) => void;
  onQuantityBlur: () => void;
}

// KHAI BÁO HELPER Ở ĐÂY (NGOÀI COMPONENT)
const generateShortDesc = (
  htmlString?: string,
  maxLength: number = 120,
): string => {
  if (!htmlString) return "";
  const cleanText = htmlString.replace(/<[^>]+>/g, "");
  if (cleanText.length <= maxLength) return cleanText;
  return cleanText.substring(0, maxLength) + "...";
};

export default function ProductDetailMain({
  product,
  selectedOptions,
  activeImageIndex,
  quantity,
  onOptionChange,
  onImageChange,
  onQuantityChange,
  onQuantityInput,
  onQuantityBlur,
}: ProductDetailMainProps) {
  const [isZoomed, setIsZoomed] = useState(false);

  const {
    isWishlisted,
    optionError,
    handleWishlistToggle,
    handleAddToCart,
    handleProcessToCheckout,
    clearOptionError,
  } = useProductDetailMain();

  useEffect(() => {
    document.body.style.overflow = isZoomed ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isZoomed]);

  if (!product) return null;

  // Xử lý Lấy ảnh chính (Ưu tiên ảnh biến thể -> ảnh gallery -> Logo dự án)
  const currentMainImage =
    product.images && product.images.length > 0
      ? product.images[activeImageIndex]
      : "/Logo.png";

  const safeQuantity = typeof quantity === "number" ? quantity : 1;
  const isOutOfStock = product.stock - (product.stockOnHold || 0) <= 0;

  // Xử lý fallback khi URL ảnh bị chết (404) hoặc nhập bậy bạ
  const handleImageError = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
  ) => {
    e.currentTarget.src = "/Logo.png";
    e.currentTarget.onerror = null;
  };

  return (
    <>
      <div className="pdp-main-section">
        {/* -- KHU VỰC ẢNH -- */}
        <div className="pdp-gallery-container">
          <div className="pdp-main-image-wrap">
            <img
              className="pdp-main-image"
              src={currentMainImage}
              alt={product.name}
              onClick={() => setIsZoomed(true)}
              onError={handleImageError}
            />
            <button
              className={`pdp-heart-btn ${isWishlisted ? "active" : ""}`}
              onClick={() => handleWishlistToggle(product.id)}
            >
              {isWishlisted ? <HeartFilledIcon /> : <HeartEmptyIcon />}
            </button>
          </div>
          {product.images.length > 0 && (
            <div className="pdp-thumbnail-list">
              {product.images.map((img, idx) => (
                <div
                  key={idx}
                  className={`pdp-thumbnail-wrap ${activeImageIndex === idx ? "active" : ""}`}
                  onClick={() => onImageChange(idx)}
                >
                  <img
                    className="pdp-thumbnail"
                    src={img}
                    alt={`${product.name} ${idx + 1}`}
                    onError={handleImageError}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* -- KHU VỰC THÔNG TIN -- */}
        <div className="pdp-info-container">
          <h1 className="pdp-title">{product.name}</h1>

          <div className="pdp-price-container">
            <span className="pdp-price">${product.price}</span>
            {product.originalPrice && (
              <span className="pdp-price-original">
                ${product.originalPrice}
              </span>
            )}
          </div>

          {/* GỌI HÀM SHORT DESC TẠI ĐÂY */}
          <p className="pdp-desc">{generateShortDesc(product.details)}</p>

          {/* RENDER ĐỘNG TẤT CẢ THUỘC TÍNH */}
          {product.options.map((option) => {
            const currentSelectedValue = selectedOptions[option.code];
            const displayLabel =
              option.values.find((v) => v.value === currentSelectedValue)
                ?.label || currentSelectedValue;

            return (
              <div key={option.code} className="pdp-option-group">
                <div className="pdp-option-header">
                  <span className="pdp-option-label">{option.label}</span>
                  <span className="pdp-option-value">{displayLabel}</span>
                </div>

                <div
                  className={
                    option.isColor ? "pdp-color-list" : "pdp-size-list"
                  }
                >
                  {option.values.map((val) => (
                    <button
                      key={val.value}
                      className={`${option.isColor ? "pdp-color-btn" : "pdp-size-btn"} ${currentSelectedValue === val.value ? "active" : ""}`}
                      style={
                        option.isColor
                          ? { backgroundColor: val.hex || val.value }
                          : {}
                      }
                      title={val.label}
                      disabled={
                        !product.hasVariants && option.values.length === 1
                      }
                      onClick={() => {
                        clearOptionError();
                        onOptionChange(option.code, val.value);
                      }}
                    >
                      {!option.isColor && val.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {optionError && <span className="pdp-error-text">{optionError}</span>}

          <div className="pdp-option-group">
            <div className="pdp-option-header">
              <span className="pdp-option-label">Quantity</span>
              {/* LƯU Ý: Nếu muốn hiển thị số lượng Available thay vì Stock tổng, bạn phải sửa chỗ này dựa vào data BE trả về */}
              <span className="pdp-option-value">
                Kho: {product.stock - (product.stockOnHold || 0)}
              </span>
            </div>
            <div className="pdp-quantity-selector">
              <button
                className="pdp-qty-btn"
                onClick={() => onQuantityChange("dec")}
                disabled={isOutOfStock}
              >
                -
              </button>
              <input
                type="text"
                className="pdp-qty-input"
                value={isOutOfStock ? 0 : quantity}
                onChange={(e) => onQuantityInput(e.target.value)}
                onBlur={onQuantityBlur}
                disabled={isOutOfStock}
              />
              <button
                className="pdp-qty-btn"
                onClick={() => onQuantityChange("inc")}
                disabled={isOutOfStock}
              >
                +
              </button>
            </div>
          </div>

          <div className="pdp-details-block">
            <h3 className="pdp-details-title">Details:</h3>
            <div
              className="pdp-details-content"
              dangerouslySetInnerHTML={{ __html: product.details }}
            ></div>
          </div>

          <div className="pdp-action-group">
            <button
              className="pdp-btn-add"
              onClick={() =>
                handleAddToCart(product, selectedOptions, safeQuantity)
              }
              disabled={isOutOfStock}
            >
              {isOutOfStock ? "Out of Stock" : "Add to Cart"}
            </button>
            <button
              className="pdp-btn-checkout"
              onClick={() =>
                handleProcessToCheckout(product, selectedOptions, safeQuantity)
              }
              disabled={isOutOfStock}
            >
              {isOutOfStock ? "Out of Stock" : "Process to Checkout"}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {isZoomed && (
        <div className="pdp-lightbox" onClick={() => setIsZoomed(false)}>
          <div
            className="pdp-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="pdp-lightbox-close"
              onClick={() => setIsZoomed(false)}
            >
              ✕
            </button>
            <img
              src={currentMainImage}
              alt={product.name}
              className="pdp-lightbox-img"
              onError={handleImageError}
            />
          </div>
        </div>
      )}
    </>
  );
}
