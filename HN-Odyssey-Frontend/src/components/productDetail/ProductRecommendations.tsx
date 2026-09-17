import { useEffect, useRef } from "react";
import { useProductRecommendations } from "../../hooks/productDetail/useProductRecommendations";
import ProductCard from "../products/ProductCard";
import type { ProductItem } from "../../hooks/products/useProductList";
import "./ProductRecommendations.css";
import axiosClient from "../../api/axiosClient";

interface RecommendationWithAlgoliaData {
  id: string;
  query_id?: string;
  queryID?: string;
  __queryID?: string;
}

export default function ProductRecommendations() {
  const gridRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTrackedView = useRef(false);

  const { recommendations } = useProductRecommendations();

  useEffect(() => {
    if (
      !recommendations ||
      recommendations.length === 0 ||
      hasTrackedView.current
    ) {
      return;
    }

    const firstItem =
      recommendations[0] as unknown as RecommendationWithAlgoliaData;
    const qId = firstItem.query_id || firstItem.queryID || firstItem.__queryID;

    if (!qId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasTrackedView.current) {
          // Gom tối đa 20 ID hiển thị thành 1 chuỗi cách nhau bằng dấu phẩy
          const displayedObjectIDs = recommendations
            .slice(0, 20)
            .map((item) => item.id)
            .join(",");

          axiosClient
            .post("/tracking/event", {
              session_id: localStorage.getItem("guestSessionId") || "guest",
              action: "VIEW_PAGE",
              path: `/widget/recommendation`,
              device: window.innerWidth < 768 ? "MOBILE" : "DESKTOP",
              metadata: {
                product_id: displayedObjectIDs,
                query_id: qId,
                suggestion_type: "PRODUCT_DETAIL_RECOMMENDATION",
              },
            })
            .catch(() => {});

          hasTrackedView.current = true;
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [recommendations]);

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  const handleScroll = (direction: "left" | "right") => {
    if (gridRef.current) {
      const scrollAmount = 320;
      gridRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="pdp-recommend-section" ref={containerRef}>
      <h2 className="pdp-recommend-title">You’ll love these</h2>
      <div className="pdp-recommend-wrapper">
        <button
          className="pdp-scroll-btn left"
          onClick={() => handleScroll("left")}
        >
          ⟨
        </button>
        <div className="pdp-recommend-grid" ref={gridRef}>
          {recommendations.map((item, index) => {
            const algoliaItem = item as typeof item & {
              queryID?: string;
              __queryID?: string;
              query_id?: string;
            };

            const productProps: ProductItem = {
              id: algoliaItem.id,
              name: algoliaItem.name,
              slug: algoliaItem.slug || "",
              sku: algoliaItem.sku || "",
              hasVariants: !!algoliaItem.hasVariants,
              initialWishlisted: !!algoliaItem.initialWishlisted,
              imageUrl: algoliaItem.imageUrl || algoliaItem.image || "",
              discountBadge: algoliaItem.discountBadge,
              desc: algoliaItem.desc || algoliaItem.description || "",
              originalPrice: algoliaItem.originalPrice,
              price: algoliaItem.price,
              tags: algoliaItem.tags || [],
              type: algoliaItem.type || "product",
              query_id:
                algoliaItem.query_id ||
                algoliaItem.queryID ||
                algoliaItem.__queryID,
              position: index + 1,
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
