// imports
import { useProductRecommendations } from "../../hooks/productDetail/useProductRecommendations";
import ProductCard from "../products/ProductCard";
import "./ProductRecommendations.css";

// component
export default function ProductRecommendations() {
  const { recommendations } = useProductRecommendations();

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  // render
  return (
    <div className="pdp-recommend-section">
      <h2 className="pdp-recommend-title">You’ll love these</h2>
      <div className="pdp-recommend-grid">
        {recommendations.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </div>
  );
}
