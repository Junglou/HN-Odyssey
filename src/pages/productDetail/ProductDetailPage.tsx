// imports
import { useProductDetail } from "../../hooks/productDetail/useProductDetail";
import "./ProductDetailPage.css";
import ProductBreadcrumb from "../../components/productDetail/ProductBreadcrumb";
import ProductDetailMain from "../../components/productDetail/ProductDetailMain";
import ProductRecommendations from "../../components/productDetail/ProductRecommendations";
import ProductReviews from "../../components/productDetail/ProductReviews";

// component
export default function ProductDetailPage() {
  // hooks
  const {
    product,
    selectedColor,
    selectedSize,
    activeImageIndex,
    quantity,
    handleColorChange,
    handleSizeChange,
    handleImageChange,
    handleQuantityChange,
    handleQuantityInput,
    handleQuantityBlur,
  } = useProductDetail();

  // render
  return (
    <div className="pdp-page-wrapper">
      <ProductBreadcrumb />
      <ProductDetailMain
        product={product}
        selectedColor={selectedColor}
        selectedSize={selectedSize}
        activeImageIndex={activeImageIndex}
        onColorChange={handleColorChange}
        onSizeChange={handleSizeChange}
        onImageChange={handleImageChange}
        quantity={quantity}
        onQuantityChange={handleQuantityChange}
        onQuantityInput={handleQuantityInput}
        onQuantityBlur={handleQuantityBlur}
      />
      <ProductRecommendations />
      <ProductReviews />
    </div>
  );
}
