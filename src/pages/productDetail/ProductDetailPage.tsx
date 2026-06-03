import { useProductDetail } from "../../hooks/productDetail/useProductDetail";
import "./ProductDetailPage.css";
import ProductBreadcrumb from "../../components/productDetail/ProductBreadcrumb";
import ProductDetailMain from "../../components/productDetail/ProductDetailMain";
import ProductRecommendations from "../../components/productDetail/ProductRecommendations";
import ProductReviews from "../../components/productDetail/ProductReviews";

export default function ProductDetailPage() {
  const {
    product,
    selectedOptions,
    activeImageIndex,
    quantity,
    handleOptionChange,
    handleImageChange,
    handleQuantityChange,
    handleQuantityInput,
    handleQuantityBlur,
  } = useProductDetail();

  return (
    <div className="pdp-page-wrapper">
      <ProductBreadcrumb />
      <ProductDetailMain
        product={product}
        selectedOptions={selectedOptions}
        activeImageIndex={activeImageIndex}
        onOptionChange={handleOptionChange}
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
