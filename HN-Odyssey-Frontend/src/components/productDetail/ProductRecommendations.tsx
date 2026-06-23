// imports
import { useRef } from "react";
import { useProductRecommendations } from "../../hooks/productDetail/useProductRecommendations";
import ProductCard from "../products/ProductCard";
import type { ProductItem } from "../../hooks/products/useProductList";
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
          {recommendations.map((item) => {
            const productProps: ProductItem = {
              id: item.id,
              name: item.name,
              slug: item.slug || "",
              sku: item.sku || "",
              hasVariants: !!item.hasVariants,
              initialWishlisted: !!item.initialWishlisted,
              imageUrl: item.imageUrl || item.image || "",
              discountBadge: item.discountBadge,
              desc: item.desc || item.description || "",
              originalPrice: item.originalPrice,
              price: item.price,
              tags: item.tags || [],
              type: item.type || "product",
            };

            return <ProductCard key={item.id} product={productProps} />;
          })}
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
