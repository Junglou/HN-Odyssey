// imports
import { useState, useEffect } from "react";
import { useProductDetailMain } from "../../hooks/productDetail/useProductDetailMain";
import {
  HeartEmptyIcon,
  HeartFilledIcon,
} from "../../assets/icons/ProductDetailIcons";
import "./ProductDetailMain.css";

// types
interface ColorOption {
  id: string;
  hex: string;
  name: string;
  images: string[];
}

interface ProductDetailMainProps {
  product: {
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    stock: number;
    desc: string;
    details: string;
    colors: ColorOption[];
    sizes: string[];
  };
  selectedColor: ColorOption;
  selectedSize: string;
  activeImageIndex: number;
  quantity: number | string;
  onColorChange: (color: ColorOption) => void;
  onSizeChange: (size: string) => void;
  onImageChange: (index: number) => void;
  onQuantityChange: (type: "inc" | "dec") => void;
  onQuantityInput: (val: string) => void;
  onQuantityBlur: () => void;
}

// component
export default function ProductDetailMain({
  product,
  selectedColor,
  selectedSize,
  activeImageIndex,
  quantity,
  onColorChange,
  onSizeChange,
  onImageChange,
  onQuantityChange,
  onQuantityInput,
  onQuantityBlur,
}: ProductDetailMainProps) {
  // states
  const [isZoomed, setIsZoomed] = useState(false);

  // hooks
  const {
    isWishlisted,
    sizeError,
    handleWishlistToggle,
    handleAddToCart,
    handleProcessToCheckout,
    clearSizeError,
  } = useProductDetailMain();

  useEffect(() => {
    if (isZoomed) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isZoomed]);

  if (!product) return null;

  // handlers
  const handleSelectSize = (size: string) => {
    clearSizeError();
    onSizeChange(size);
  };

  const hasImages = selectedColor.images && selectedColor.images.length > 0;
  const currentMainImage = hasImages
    ? selectedColor.images[activeImageIndex]
    : "https://via.placeholder.com/960x740?text=No+Image";

  const safeQuantity = typeof quantity === "number" ? quantity : 1;
  const isOutOfStock = product.stock <= 0;

  // render
  return (
    <>
      <div className="pdp-main-section">
        <div className="pdp-gallery-container">
          <div className="pdp-main-image-wrap">
            <img
              className="pdp-main-image"
              src={currentMainImage}
              alt={product.name}
              onClick={() => setIsZoomed(true)}
            />
            <button
              className={`pdp-heart-btn ${isWishlisted ? "active" : ""}`}
              onClick={() => handleWishlistToggle(product.id)}
            >
              {isWishlisted ? <HeartFilledIcon /> : <HeartEmptyIcon />}
            </button>
          </div>

          {hasImages && (
            <div className="pdp-thumbnail-list">
              {selectedColor.images.map((img, idx) => (
                <div
                  key={idx}
                  className={`pdp-thumbnail-wrap ${activeImageIndex === idx ? "active" : ""}`}
                  onClick={() => onImageChange(idx)}
                >
                  <img
                    className="pdp-thumbnail"
                    src={img}
                    alt={`${product.name} ${idx + 1}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

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

          <p className="pdp-desc">{product.desc}</p>

          <div className="pdp-option-group">
            <div className="pdp-option-header">
              <span className="pdp-option-label">Color</span>
              <span className="pdp-option-value">{selectedColor.name}</span>
            </div>
            <div className="pdp-color-list">
              {product.colors.map((color) => (
                <button
                  key={color.id}
                  className={`pdp-color-btn ${selectedColor.id === color.id ? "active" : ""}`}
                  style={{ backgroundColor: color.hex }}
                  onClick={() => onColorChange(color)}
                  title={color.name}
                ></button>
              ))}
            </div>
          </div>

          <div className="pdp-option-group">
            <div className="pdp-option-header">
              <span className="pdp-option-label">Size</span>
            </div>
            <div className="pdp-size-list">
              {product.sizes.map((size) => (
                <button
                  key={size}
                  className={`pdp-size-btn ${selectedSize === size ? "active" : ""}`}
                  onClick={() => handleSelectSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
            {sizeError && <span className="pdp-error-text">{sizeError}</span>}
          </div>

          <div className="pdp-option-group">
            <div className="pdp-option-header">
              <span className="pdp-option-label">Quantity</span>
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
                style={{ width: `${Math.max(2, String(quantity).length)}ch` }}
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
            <div className="pdp-details-content">
              {product.details.split("\n").map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
          </div>

          <div className="pdp-action-group">
            <button
              className="pdp-btn-add"
              onClick={() =>
                handleAddToCart(
                  product.id,
                  selectedColor,
                  selectedSize,
                  safeQuantity,
                )
              }
              disabled={isOutOfStock}
            >
              {isOutOfStock ? "Out of Stock" : "Add to Cart"}
            </button>
            <button
              className="pdp-btn-checkout"
              onClick={() =>
                handleProcessToCheckout(
                  product.id,
                  selectedColor,
                  selectedSize,
                  safeQuantity,
                )
              }
              disabled={isOutOfStock}
            >
              {isOutOfStock ? "Out of Stock" : "Process to Checkout"}
            </button>
          </div>
        </div>
      </div>

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
            />
          </div>
        </div>
      )}
    </>
  );
}
