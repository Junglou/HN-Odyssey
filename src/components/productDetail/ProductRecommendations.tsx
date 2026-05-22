// imports
import { useRef } from "react";
import { useProductRecommendations } from "../../hooks/productDetail/useProductRecommendations";
import ProductCard from "../products/ProductCard";
import "./ProductRecommendations.css";

// component
export default function ProductRecommendations() {
  // refs
  const gridRef = useRef<HTMLDivElement>(null);

  // hooks
  const { recommendations } = useProductRecommendations();

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  // handlers
  const handleScroll = (direction: "left" | "right") => {
    if (gridRef.current) {
      const scrollAmount = 320;
      gridRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // render
  return (
    <div className="pdp-recommend-section">
      <h2 className="pdp-recommend-title">You’ll love these</h2>
      <div className="pdp-recommend-wrapper">
        <button
          className="pdp-scroll-btn left"
          onClick={() => handleScroll("left")}
        >
          ⟨
        </button>
        <div className="pdp-recommend-grid" ref={gridRef}>
          {recommendations.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
        <button
          className="pdp-scroll-btn right"
          onClick={() => handleScroll("right")}
        >
          ⟩
        </button>
      </div>
    </div>
  );
}
