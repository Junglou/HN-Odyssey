// imports
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
}

interface ProductDetailMainProps {
  product: {
    name: string;
    price: number;
    desc: string;
    details: string;
    colors: ColorOption[];
    sizes: string[];
    images: string[];
  };
  selectedColor: ColorOption;
  selectedSize: string;
  activeImageIndex: number;
  onColorChange: (color: ColorOption) => void;
  onSizeChange: (size: string) => void;
  onImageChange: (index: number) => void;
}

// component
export default function ProductDetailMain({
  product,
  selectedColor,
  selectedSize,
  activeImageIndex,
  onColorChange,
  onSizeChange,
  onImageChange,
}: ProductDetailMainProps) {
  // hooks
  const {
    isWishlisted,
    handleWishlistToggle,
    handleAddToCart,
    handleProcessToCheckout,
  } = useProductDetailMain();

  // render
  return (
    <div className="pdp-main-section">
      <div className="pdp-gallery-container">
        <div className="pdp-main-image-wrap">
          <div
            className="pdp-main-image"
            style={{
              backgroundImage: `url(${product.images[activeImageIndex]})`,
            }}
          ></div>
          <button
            className={`pdp-heart-btn ${isWishlisted ? "active" : ""}`}
            onClick={handleWishlistToggle}
          >
            {isWishlisted ? <HeartFilledIcon /> : <HeartEmptyIcon />}
          </button>
        </div>

        <div className="pdp-thumbnail-list">
          {product.images.map((img, idx) => (
            <div
              key={idx}
              className={`pdp-thumbnail-wrap ${activeImageIndex === idx ? "active" : ""}`}
              onClick={() => onImageChange(idx)}
            >
              <div
                className="pdp-thumbnail"
                style={{ backgroundImage: `url(${img})` }}
              ></div>
            </div>
          ))}
        </div>
      </div>

      <div className="pdp-info-container">
        <h1 className="pdp-title">{product.name}</h1>
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
                onClick={() => onSizeChange(size)}
              >
                {size}
              </button>
            ))}
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
          <button className="pdp-btn-add" onClick={handleAddToCart}>
            Add to Cart
          </button>
          <button
            className="pdp-btn-checkout"
            onClick={handleProcessToCheckout}
          >
            Process to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
